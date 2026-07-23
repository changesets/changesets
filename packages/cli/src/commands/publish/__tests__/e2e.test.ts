import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import { createGzip } from "node:zlib";
import { tagExists } from "@changesets/git";
import { packTar, type TarSource } from "modern-tar/fs";
import { exec } from "tinyexec";
import { describe, expect, it } from "vitest";
import { AsyncDisposableStack } from "../../../ponyfills/async-disposable-stack.ts";
import {
  AbortableAsyncDisposableStack,
  cliPackageRoot,
  createPkgAFixture,
  createTempDir,
  getFreePort,
  getPmBinPath,
  pmCases,
  runCliCommand,
  type TestRegistryConfig,
} from "../../__tests__/e2e-utils.ts";

type RegistryRequestRecord = {
  bodyJson?: unknown;
  bodyLength?: number;
  headers: http.IncomingHttpHeaders;
  method: string;
  packageName?: string;
  pathname: string;
  authorization?: string;
  otpCode?: string;
  statusCode?: number;
};

type PackageAuthRequirement = {
  token: string;
  otp?: {
    code: string;
    webAuth?: boolean;
  };
};

type AuthProxyConfig = {
  packages?: Record<string, PackageAuthRequirement>;
  scopes?: Record<string, PackageAuthRequirement>;
};

type RegistryProxyConfig = {
  auth?: AuthProxyConfig;
  middleware?: RegistryMiddleware;
};

type SeedPackageState = {
  tags: Record<string, string>;
  versions: string[];
};

type SeedRegistryState = Record<string, SeedPackageState>;

type ProxyMiddlewareContext = {
  pnpr: {
    fetch(request: Request): Promise<Response>;
    seedPackage(packageName: string, state: SeedPackageState): Promise<void>;
  };
  record: RegistryRequestRecord;
  request: Request;
};

type RegistryMiddleware = (
  context: ProxyMiddlewareContext,
) => Promise<Response | undefined>;

type TestRegistry = {
  host: string;
  pnprToken: string;
  requests: RegistryRequestRecord[];
  url: string;
  [Symbol.asyncDispose](): Promise<void>;
};

type TarballContentEntry = {
  path: string;
  content: string | Uint8Array;
};

type PackedPackage = {
  name: string;
  version: string;
};

const TAR_ENTRY_MODE = 0o644;
const TAR_ENTRY_MTIME = new Date("1985-10-26T08:15:00.000Z");
// This token models npmjs-facing auth at the proxy layer. pnpr's own token is still needed upstream.
// We can't reliably use pnpr tokens to check validity at publish time (read and write accesses can be configured differently).
// We could get away with just using matching read/write $authenticated settings, but
// - pnpr /GET can't reliably distinguish between "missing package" + "bad token"/"good token"
// - it doesn't seem to even validate the tokens for existing packages.
const CLIENT_AUTH_TOKEN = "publ1sh-t0k3n";
const BAD_CLIENT_AUTH_TOKEN = "wr0ng-t0k3n";

function getPackageName(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("@") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
}

function withBearerToken(request: Request, token: string) {
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return new Request(request, { headers });
}

function getAuthRequirement(
  packageName: string | undefined,
  config: AuthProxyConfig,
) {
  if (!packageName) return;
  const packageRequirement = config.packages?.[packageName];
  if (packageRequirement) return packageRequirement;

  const scope = packageName.startsWith("@")
    ? packageName.split("/")[0]
    : undefined;
  return scope ? config.scopes?.[scope] : undefined;
}

function tryParseJson(input: Buffer) {
  try {
    return JSON.parse(input.toString("utf8"));
  } catch {
    return undefined;
  }
}

function toWebHeaders(
  headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders,
) {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(key, item);
      }
    } else if (value != null) {
      result.set(key, String(value));
    }
  }
  return result;
}

function hasRequestBody(headers: Headers) {
  return (
    headers.get("content-length") != null ||
    headers.get("transfer-encoding") != null
  );
}

async function createWebRequest(req: http.IncomingMessage) {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const headers = toWebHeaders(req.headers);
  return new Request(url, {
    body: hasRequestBody(headers) ? req : undefined,
    duplex: "half",
    headers,
    method,
  });
}

async function recordRequestBody(
  request: Request,
  record: RegistryRequestRecord,
) {
  if (!hasRequestBody(request.headers)) {
    return;
  }
  const body = Buffer.from(await request.clone().arrayBuffer());
  record.bodyLength = body.byteLength;
  if (/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    record.bodyJson = tryParseJson(body);
  }
  return record.bodyJson;
}

async function writeResponse(res: http.ServerResponse, response: Response) {
  const headers: http.OutgoingHttpHeaders = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  delete headers["content-encoding"];
  delete headers["transfer-encoding"];
  res.writeHead(response.status, response.statusText, headers);
  if (response.body) {
    await pipeline(Readable.fromWeb(response.body), res);
  } else {
    res.end();
  }
}

function createWebServer(handler: (request: Request) => Promise<Response>) {
  return http.createServer((req, res) => {
    void (async () => {
      try {
        await writeResponse(res, await handler(await createWebRequest(req)));
      } catch {
        await writeResponse(
          res,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        );
      }
    })();
  });
}

function normalizeOtpPrompts(message: string) {
  return (
    message
      // Yarn redraws the completed prompt on the same terminal line.
      .replace(
        /^[?√] One-time password:[^\n]*?(?=(➤ YN)|$)/gm,
        (_match, continuedOutput: string | undefined) =>
          `? One-time password: [prompt]${continuedOutput ? "\n\n" : ""}`,
      )
      // pnpm redraws the prompt after every entered digit.
      .replace(
        /Enter OTP:[^\n]*?(?:\?|✔) This operation requires a one-time password\.(?:\n|(?=Enter OTP:))/g,
        "",
      )
      // npm may render the prompt and entered code on separate terminal lines.
      .replace(/Enter OTP:(?:\n[ \t]*)+(\d{6})/g, "Enter OTP: $1")
      // npm 10 may concatenate the following publish result onto the prompt.
      .replace(/(Enter OTP: \d{6})(?=\+ )/g, "$1\n\n")
  );
}

function sanitizePublishLog(message: unknown, registryUrl: string) {
  const output = stripVTControlCharacters(
    String(message).replace(
      // Strip OSC sequences first because stripVTControlCharacters removes
      // their introducer but leaves the title and terminator behind.
      // eslint-disable-next-line no-control-regex -- OSC sequences are delimited by ESC and BEL control characters.
      /\u001B\](?:[^\u0007\u001B]|\u001B(?!\\))*(?:\u0007|\u001B\\)/g,
      "",
    ),
  )
    // Windows PTYs may duplicate the carriage return in CRLF.
    .replace(/\r+\n/g, "\n")
    // Standalone carriage returns redraw the current line rather than adding
    // a new one. Removing them lets the redraw normalizers below collapse
    // the concatenated terminal states.
    .replaceAll("\r", "")
    .replace(/^npm notice 📦[ \t]+/gm, "npm notice package: ")
    .replace(/changeset v\S+/g, "changeset v[version]")
    .replace(/(➤ YN0000: Done in )\d+s \d+ms/g, "$1[duration]")
    .replace(/^[A-Za-z]:\\(?:[^\\\r\n]+\\)*cmd\.exe \/d \/s \/c /gim, "sh -c ")
    .replace(
      /logs can be found here: .*?\.log/g,
      "logs can be found here: [yarn-prepack-log]",
    )
    .replace(/^npm notice shasum: .+$/gm, "npm notice shasum: [shasum]")
    .replace(
      /^npm notice integrity: .+$/gm,
      "npm notice integrity: [integrity]",
    );

  return normalizeOtpPrompts(output)
    .replaceAll(
      /(?:^[◒◐◓◑•oO0] {2}Creating git tag\.*\n)+(?=^[◇o] {2}Created git tag\.$)/gm,
      "",
    )
    .replaceAll(/^o {2}Created git tag\.$/gm, "◇  Created git tag.")
    .replaceAll(
      /[◒◐◓◑•oO0] {2}(?:(?:━|=)+ )?(Publishing packages|Creating git tags)(?: \(\d+\/\d+\)|\.*)(?:(?:\n[ \t]*)*[◒◐◓◑•oO0] {2}(?:(?:━|=)+ )?\1(?: \(\d+\/\d+\)|\.*))*/g,
      (_match, message: string) => `◒  ${message}`,
    )
    .replaceAll(
      /(?:◒ {2}Publishing packages(?:\n[ \t]*)*)+[◇o] {2}([^\n]*requires 2FA verification to publish\.\.\.)(?:\n[ \t]*)*/g,
      "◒  Publishing packages◇  $1\n",
    )
    .replaceAll(
      /(?:◒ {2}Publishing packages(?:\n[ \t]*)*)*(?:[◇o] {2}(Successfully published:)|[▲x] {2}(Failed to publish))/g,
      (_match, success: string | undefined, failure: string | undefined) =>
        `◒  Publishing packages${success ? `◇  ${success}` : `▲  ${failure}`}`,
    )
    .replaceAll(
      /(?:◒ {2}Creating git tags(?:\n[ \t]*)*)*[◇o] {2}(Created git tags[:.])/g,
      "◒  Creating git tags◇  $1",
    )
    .replace(/(Created git tags\.)\n+$/, "$1\n")
    .replace(/(\n- [^\n]+)\n+$/, "$1\n")
    .replaceAll(new URL(registryUrl).origin, "[registry-url]")
    .replaceAll(/\/-\/auth\/cli\/[^\s"]+/g, "/-/auth/cli/[uuid]")
    .replaceAll(/\/-\/v1\/done\?authId=[^\s"]+/g, "/-/v1/done?authId=[uuid]");
}

async function fetchPackument(registry: TestRegistry, packageName: string) {
  const response = await fetch(
    new URL(encodeURIComponent(packageName), registry.url),
    {
      signal: AbortSignal.timeout(5_000),
    },
  );
  expect.soft(response.status).toBe(200);
  return response.json();
}

async function waitForRegistry(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(250),
      });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await setTimeout(100);
  }
  throw new Error(`Timed out waiting for pnpr at ${url}`, {
    cause: lastError,
  });
}

async function createPnprUser(pnprUrl: string) {
  const username = `test-${randomUUID()}`;
  const response = await fetch(
    new URL(`-/user/org.couchdb.user:${username}`, pnprUrl),
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        _id: `org.couchdb.user:${username}`,
        name: username,
        password: "Seed-password-123!",
        email: `${username}@example.com`,
        type: "user",
        roles: [],
        date: new Date().toISOString(),
      }),
    },
  );
  const body = await response.json();
  if (
    !response.ok ||
    typeof body !== "object" ||
    body == null ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    throw new Error(
      `Failed to create pnpr user: ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body.token;
}

function getPackageTarballFilename(packageName: string, version: string) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function packTarball(entries: TarballContentEntry[]) {
  const sources: TarSource[] = entries.map((entry) => ({
    type: "content",
    target: entry.path,
    content: entry.content,
    mode: TAR_ENTRY_MODE,
    mtime: TAR_ENTRY_MTIME,
  }));
  const chunks: Buffer[] = [];
  const stream = packTar(sources).pipe(createGzip());

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function createPackedDir(cwd: string, packages: PackedPackage[]) {
  const packedDir = path.join(cwd, ".packed");
  const packagesDir = path.join(packedDir, "packages");
  await fs.mkdir(packagesDir, { recursive: true });
  const plan = [];

  for (const pkg of packages) {
    const manifest = {
      name: pkg.name,
      version: pkg.version,
      description: "",
      files: ["index.js"],
      license: "MIT",
      type: "module",
      changesetsPackedManifest: true,
    };
    const tarball = await packTarball([
      {
        path: "package/package.json",
        content: `${JSON.stringify(manifest, undefined, 2)}\n`,
      },
      { path: "package/index.js", content: `export default '${pkg.name}';\n` },
    ]);
    const filename = getPackageTarballFilename(pkg.name, pkg.version);
    await fs.writeFile(path.join(packagesDir, filename), tarball);
    plan.push({
      kind: "publish",
      name: pkg.name,
      version: pkg.version,
      access: "public",
      tag: "latest",
      tarball: {
        path: `packages/${filename}`,
        integrity: `sha256-${createHash("sha256").update(tarball).digest("base64")}`,
      },
    });
  }

  await fs.writeFile(
    path.join(packedDir, "publish-plan.json"),
    JSON.stringify({
      version: 1,
      plan: [plan],
    }),
  );
  return packedDir;
}

async function publishSeedPackage(
  pnprUrl: string,
  pnprToken: string,
  packageName: string,
  version: string,
  tags: string[],
) {
  const manifest = {
    name: packageName,
    version,
    description: "",
    files: ["index.js"],
    license: "MIT",
    type: "module",
  };
  const tarball = await packTarball([
    {
      path: "package/package.json",
      content: `${JSON.stringify(manifest, undefined, 2)}\n`,
    },
    { path: "package/index.js", content: "export default 1;\n" },
  ]);
  const filename = getPackageTarballFilename(packageName, version);
  const response = await fetch(
    new URL(encodeURIComponent(packageName), pnprUrl),
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${pnprToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        _attachments: {
          [filename]: {
            content_type: "application/octet-stream",
            data: tarball.toString("base64"),
            length: tarball.byteLength,
          },
        },
        _id: packageName,
        "dist-tags": Object.fromEntries(tags.map((tag) => [tag, version])),
        name: packageName,
        versions: {
          [version]: {
            ...manifest,
            _id: `${manifest.name}@${manifest.version}`,
            dist: {
              integrity: `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
              shasum: createHash("sha1").update(tarball).digest("hex"),
              tarball: new URL(
                `${encodeURIComponent(packageName)}/-/${filename}`,
                pnprUrl,
              ).href,
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to seed ${packageName}@${version}: ${response.status} ${await response.text()}`,
    );
  }
}

async function seedPackage(
  pnprUrl: string,
  pnprToken: string,
  packageName: string,
  state: SeedPackageState,
) {
  const versionSet = new Set(state.versions);
  for (const [tag, version] of Object.entries(state.tags)) {
    if (!versionSet.has(version)) {
      throw new Error(
        `Cannot seed ${packageName}: dist-tag ${tag} points to missing version ${version}`,
      );
    }
  }

  for (const version of state.versions) {
    const tags = Object.entries(state.tags)
      .filter(([, taggedVersion]) => taggedVersion === version)
      .map(([tag]) => tag);
    await publishSeedPackage(pnprUrl, pnprToken, packageName, version, tags);
  }
}

function execChild(
  command: Parameters<typeof exec>[0],
  args?: Parameters<typeof exec>[1],
  options?: Omit<Parameters<typeof exec>[2], "persist">,
) {
  const child = exec(command, args, {
    ...options,
    // so the dispose can kill the whole process group
    persist: true,
  });

  let disposing: Promise<void> | undefined;

  async function dispose(): Promise<void> {
    const processHandle = child.process;
    const pid = child.pid;

    if (
      !processHandle ||
      !pid ||
      processHandle.exitCode != null ||
      processHandle.signalCode != null
    ) {
      return;
    }

    const closed = once(processHandle, "close");

    if (process.platform === "win32") {
      await new Promise<void>((resolve, reject) => {
        execFile(
          "taskkill.exe",
          ["/PID", String(pid), "/T", "/F"],
          { windowsHide: true },
          (error) => {
            if (error && error.code !== 128) {
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
              reject(error);
            } else {
              resolve();
            }
          },
        );
      });

      await closed;
      return;
    }

    const killGroup = (signal: NodeJS.Signals) => {
      try {
        process.kill(-pid, signal);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ESRCH"
        ) {
          throw error;
        }
      }
    };

    killGroup("SIGTERM");

    const closedGracefully = await Promise.race([
      closed.then(() => true),
      setTimeout(1_000, false),
    ]);

    if (!closedGracefully) {
      killGroup("SIGKILL");
      await closed;
    }
  }

  return {
    child,

    [Symbol.asyncDispose]() {
      return (disposing ??= dispose());
    },
  };
}

async function createPnprRegistry() {
  await using stack = new AsyncDisposableStack();
  const root = stack.use(await createTempDir("changesets-pnpr-"));
  const storage = path.join(root.path, "storage");
  const config = path.join(root.path, "pnpr.yaml");
  // pnpr accepts `--listen 127.0.0.1:0`, but it currently doesn't expose the
  // actual bound port to the parent process, and its default/public tarball
  // URLs are derived from the configured address (`:0`) rather than the bound
  // listener address. Precompute for now so `--public-url` is usable.
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}/`;
  await fs.mkdir(storage);
  await fs.writeFile(
    config,
    `
storage: ${JSON.stringify(storage)}
secret: changesets-test-secret-key-32-bytes
auth:
  htpasswd:
    max_users: 100
registries:
  local:
    type: hosted
    access: $all
    packages:
      "**":
        access: $all
        publish: $authenticated
        unpublish: $authenticated
  main:
    type: router
    sources: [local]
defaultRegistry: main
web:
  enable: false
log:
  type: stdout
  format: pretty
  level: error
`.trimStart(),
  );

  const execResult = stack.use(
    execChild(
      path.join(cliPackageRoot, "node_modules", ".bin", "pnpr"),
      [
        "--config",
        config,
        "--listen",
        `127.0.0.1:${port}`,
        "--storage",
        storage,
        "--public-url",
        url,
      ],
      {
        nodeOptions: {
          cwd: cliPackageRoot,
          stdio: ["ignore", "pipe", "pipe"],
        },
      },
    ),
  );
  const { child } = execResult;
  const pnprProcess = child.process!;
  const pnprStdout = pnprProcess.stdout!;
  const pnprStderr = pnprProcess.stderr!;
  let output = "";
  const collectOutput = (chunk: string) => {
    output += chunk;
  };
  pnprStdout.setEncoding("utf8");
  pnprStdout.on("data", collectOutput);
  pnprStderr.setEncoding("utf8");
  pnprStderr.on("data", collectOutput);

  const startupFailure = Promise.withResolvers<never>();
  const rejectStartupOnError = (error: Error) => {
    startupFailure.reject(error);
  };
  const rejectStartupOnExit = (
    code: number | null,
    signal: NodeJS.Signals | null,
  ) => {
    startupFailure.reject(
      new Error(`pnpr exited before startup: ${code ?? signal}\n${output}`),
    );
  };
  pnprProcess.once("error", rejectStartupOnError);
  pnprProcess.once("exit", rejectStartupOnExit);
  if (pnprProcess.exitCode != null || pnprProcess.signalCode != null) {
    rejectStartupOnExit(pnprProcess.exitCode, pnprProcess.signalCode);
  }

  try {
    await Promise.race([waitForRegistry(url), startupFailure.promise]);
  } finally {
    pnprProcess.removeListener("error", rejectStartupOnError);
    pnprProcess.removeListener("exit", rejectStartupOnExit);
    pnprStdout.removeListener("data", collectOutput);
    pnprStderr.removeListener("data", collectOutput);
  }

  const cleanup = stack.move();
  return {
    url,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
}

async function fetchPnpr(pnprUrl: string, request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const upstream = new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    pnprUrl,
  );
  const headers = new Headers(request.headers);
  headers.set("host", upstream.host);
  headers.delete("content-length");

  try {
    return await fetch(upstream, {
      body: hasRequestBody(request.headers) ? request.body : undefined,
      duplex: "half",
      headers,
      method: request.method,
    });
  } catch {
    return new Response("Bad Gateway", { status: 502 });
  }
}

async function createAuthProxy(
  pnprUrl: string,
  pnprToken: string,
  config: RegistryProxyConfig = {},
) {
  const requests: RegistryRequestRecord[] = [];

  const server = createWebServer(async (webRequest) => {
    const url = new URL(webRequest.url);
    const pathname = decodeURIComponent(url.pathname);
    const packageName = getPackageName(pathname);
    const authRequirement = getAuthRequirement(packageName, config.auth ?? {});
    const request: RegistryRequestRecord = {
      headers: Object.fromEntries(webRequest.headers),
      method: webRequest.method,
      packageName,
      pathname,
      authorization: webRequest.headers.get("authorization") ?? undefined,
      otpCode: webRequest.headers.get("npm-otp") ?? undefined,
    };
    requests.push(request);
    await recordRequestBody(webRequest, request);

    if (authRequirement && packageName) {
      if (request.method !== "PUT") {
        webRequest = withBearerToken(webRequest, pnprToken);
      } else {
        if (request.authorization !== `Bearer ${authRequirement.token}`) {
          request.statusCode = 401;
          return Response.json(
            {
              error: "Unauthorized",
              code: "E401",
              reason: "Invalid authentication token.",
            },
            { status: 401 },
          );
        }

        if (
          authRequirement.otp &&
          request.otpCode !== authRequirement.otp.code
        ) {
          request.statusCode = 401;
          if (
            authRequirement.otp.webAuth &&
            webRequest.headers.get("npm-auth-type") === "web"
          ) {
            const authId = randomUUID();
            const registryUrl = `http://${webRequest.headers.get("host")}/`;
            return Response.json(
              {
                authUrl: new URL(`-/auth/cli/${authId}`, registryUrl).href,
                doneUrl: new URL(`-/v1/done?authId=${authId}`, registryUrl)
                  .href,
              },
              {
                headers: { "www-authenticate": "OTP" },
                status: 401,
              },
            );
          }
          return Response.json(
            {
              error:
                "You must provide a one-time pass. Upgrade your client to npm@latest in order to use 2FA.",
            },
            {
              headers: { "www-authenticate": "OTP" },
              status: 401,
            },
          );
        }
        webRequest = withBearerToken(webRequest, pnprToken);
      }
    }

    const middlewareResponse = await config.middleware?.({
      pnpr: {
        fetch(pnprRequest) {
          return fetchPnpr(pnprUrl, pnprRequest);
        },
        seedPackage(packageName, state) {
          return seedPackage(pnprUrl, pnprToken, packageName, state);
        },
      },
      record: request,
      request: webRequest,
    });
    if (middlewareResponse) {
      request.statusCode = middlewareResponse.status;
      return middlewareResponse;
    }

    const response = await fetchPnpr(pnprUrl, webRequest);
    request.statusCode = response.status;
    return response;
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected proxy server to listen on a TCP port");
  }

  return {
    requests,
    url: `http://127.0.0.1:${address.port}/`,
    [Symbol.asyncDispose]: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function createTestRegistry(options?: {
  auth?: AuthProxyConfig;
  middleware?: RegistryProxyConfig["middleware"];
  packages?: SeedRegistryState;
}): Promise<TestRegistry> {
  await using stack = new AsyncDisposableStack();
  const pnpr = stack.use(await createPnprRegistry());
  const pnprToken = await createPnprUser(pnpr.url);
  for (const [packageName, state] of Object.entries(options?.packages ?? {})) {
    await seedPackage(pnpr.url, pnprToken, packageName, state);
  }
  const proxy = stack.use(
    await createAuthProxy(pnpr.url, pnprToken, {
      auth: options?.auth,
      middleware: options?.middleware,
    }),
  );
  const cleanup = stack.move();

  return {
    host: new URL(proxy.url).host,
    pnprToken,
    requests: proxy.requests,
    url: proxy.url,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
}

function createPmContext(
  registry: TestRegistry,
  pmBinPath: string,
  authToken: TestRegistryConfig["authToken"] = registry.pnprToken,
) {
  return {
    pmBinPath,
    registry: {
      authToken,
      host: registry.host,
      url: registry.url,
    },
  };
}

describe("Publish command e2e", { tags: ["slow"] }, () => {
  describe.each(pmCases)("$name", (pm) => {
    it("publishes a new version of a package", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("surfaces pre-publish errors", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(createPmContext(registry, pmBinPath), {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          description: "",
          files: ["index.js"],
          license: "MIT",
          scripts: {
            prepack:
              "node -e \"console.log(JSON.stringify({ lifecycle: 'output' })); console.error('prepack failed'); process.exit(1)\"",
          },
          type: "module",
        }),
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("publishes a first version of a package", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createTestRegistry());
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("handles lifecycle stdout while publishing", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createTestRegistry());
      const cwd = await pm.gitdir(createPmContext(registry, pmBinPath), {
        ...createPkgAFixture(),
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          description: "",
          files: ["index.js"],
          license: "MIT",
          scripts: {
            prepack:
              "node -e \"console.log(JSON.stringify({ lifecycle: 'output' }))\"",
          },
          type: "module",
        }),
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("publishes a new pre version of an only-pre package without existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.0"],
              tags: { beta: "1.0.0-beta.0" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
        },
        name: "pkg-a",
      });
      expect.soft(initialPackument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(true);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.0": {
            name: "pkg-a",
            version: "1.0.0-beta.0",
          },
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it("publishes a new pre version of an only-pre package with existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.0"],
              tags: {
                beta: "1.0.0-beta.0",
                latest: "1.0.0-beta.0",
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
          latest: "1.0.0-beta.0",
        },
        name: "pkg-a",
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(true);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.0",
          latest: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.0": {
            name: "pkg-a",
            version: "1.0.0-beta.0",
          },
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it("skips already-published pre version of an only-pre package without existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.1"],
              tags: { beta: "1.0.0-beta.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const initialPackument = await fetchPackument(registry, "pkg-a");
      expect.soft(initialPackument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0-beta.1!");
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        "dist-tags": {
          latest: expect.anything(),
        },
      });
    });

    it("skips already-published pre version of an only-pre package with existing latest tag", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0-beta.1"],
              tags: {
                beta: "1.0.0-beta.1",
                latest: "1.0.0-beta.1",
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture({ version: "1.0.0-beta.1", pre: "beta" }),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0-beta.1!");
      await expect
        .soft(tagExists("pkg-a@1.0.0-beta.1", cwd))
        .resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          beta: "1.0.0-beta.1",
          latest: "1.0.0-beta.1",
        },
        name: "pkg-a",
        versions: {
          "1.0.0-beta.1": {
            name: "pkg-a",
            version: "1.0.0-beta.1",
          },
        },
      });
    });

    it.runIf(pm.name !== "yarn 4")(
      "publishes from a pack directory",
      async ({ signal }) => {
        await using stack = new AbortableAsyncDisposableStack(signal);
        const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
        const registry = stack.use(await createTestRegistry());
        const cwd = await pm.gitdir(
          createPmContext(registry, pmBinPath),
          createPkgAFixture(),
        );
        const packedDir = await createPackedDir(cwd, [
          { name: "pkg-a", version: "1.0.0" },
        ]);

        const result = await runCliCommand({
          command: "publish",
          args: ["--from-pack-dir", packedDir],
          cwd,
          pmBinPath,
          signal,
        });
        expect.soft(result.exitCode).toBe(0);

        const publishRequests = registry.requests.filter(
          (request) =>
            request.method === "PUT" && request.pathname === "/pkg-a",
        );
        expect.soft(publishRequests).toEqual([
          expect.objectContaining({
            authorization: `Bearer ${registry.pnprToken}`,
            otpCode: undefined,
            statusCode: 201,
          }),
        ]);

        await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(true);
        const packument = await fetchPackument(registry, "pkg-a");
        expect.soft(packument).toMatchObject({
          "dist-tags": {
            latest: "1.0.0",
          },
          name: "pkg-a",
          versions: {
            "1.0.0": {
              name: "pkg-a",
              version: "1.0.0",
              changesetsPackedManifest: true,
            },
          },
        });
      },
    );

    it("surfaces publish failures for bad credentials", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, BAD_CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${BAD_CLIENT_AUTH_TOKEN}`,
          statusCode: 401,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("surfaces publish failures when not logged in", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, null),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect
        .soft(
          publishRequests.map(({ authorization, statusCode }) => ({
            authorization,
            statusCode,
          })),
        )
        .toEqual(
          // Most package managers fail locally when no token is configured. pnpm 11
          // still sends the publish request and lets the registry reject it.
          pm.name === "pnpm 11"
            ? [{ authorization: undefined, statusCode: 401 }]
            : [],
        );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("does not publish an already-published version", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["1.0.0"],
              tags: { latest: "1.0.0" },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });

      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);
      expect
        .soft(
          registry.requests.filter(
            (request) =>
              request.method === "PUT" && request.pathname === "/pkg-a",
          ),
        )
        .toEqual([]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it("skips already-published version publish errors after our publish plan preflight", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      let packageSeeded = false;
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          async middleware({ pnpr, record, request }) {
            if (record.packageName !== "pkg-a") {
              return;
            }

            if (request.method === "GET" && !packageSeeded) {
              const response = await pnpr.fetch(request);
              await pnpr.seedPackage("pkg-a", {
                versions: ["1.0.0"],
                tags: { latest: "1.0.0" },
              });
              packageSeeded = true;
              return response;
            }

            if (request.method === "PUT") {
              // pnpr currently accepts publishing over an existing version here, while
              // npm rejects it. Keep this response synthetic to exercise npm's
              // already-published race semantics.
              return Response.json(
                {
                  error:
                    "You cannot publish over the previously published versions: 1.0.0.",
                  success: false,
                },
                { status: 403 },
              );
            }
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(publishRequests.map((request) => request.statusCode)).toEqual(
        // Bun with --tolerate-republish and npm 11+ detect an already-published
        // version during preflight. Other clients send the PUT and receive 403.
        pm.name !== "bun 1" && pm.name !== "npm 11" && pm.name !== "npm 12"
          ? [403]
          : [],
      );
    });

    it("skips already-published version publish errors after possible package manager preflights", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          async middleware({ pnpr, record, request }) {
            if (request.method !== "PUT" || record.packageName !== "pkg-a") {
              return;
            }

            const body = record.bodyJson;
            const requestedVersions =
              body &&
              typeof body === "object" &&
              "versions" in body &&
              body.versions &&
              typeof body.versions === "object"
                ? Object.keys(body.versions)
                : [];

            if (!requestedVersions.includes("1.0.0")) {
              return pnpr.fetch(request);
            }

            await pnpr.seedPackage("pkg-a", {
              versions: ["1.0.0"],
              tags: { latest: "1.0.0" },
            });
            // pnpr currently accepts publishing over an existing version here, while
            // npm rejects it. Keep this response synthetic to exercise npm's
            // already-published race semantics.
            return Response.json(
              {
                error:
                  "You cannot publish over the previously published versions: 1.0.0.",
                success: false,
              },
              { status: 403 },
            );
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .not.toContain("Published pkg-a@1.0.0!");
      await expect.soft(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);
      expect.soft(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          statusCode: 403,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });

    it.runIf(pm.name !== "yarn 4")(
      "reads initial otp from env in non-tty mode",
      async ({ signal }) => {
        await using stack = new AbortableAsyncDisposableStack(signal);
        const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
        const registry = stack.use(
          await createTestRegistry({
            packages: {
              "pkg-a": {
                versions: ["0.0.1"],
                tags: { latest: "0.0.1" },
              },
            },
            auth: {
              packages: {
                "pkg-a": {
                  token: CLIENT_AUTH_TOKEN,
                  otp: { code: "654321" },
                },
              },
            },
          }),
        );
        const cwd = await pm.gitdir(
          createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
          createPkgAFixture(),
        );

        const result = await runCliCommand({
          command: "publish",
          cwd,
          env: {
            [pm.name.startsWith("pnpm 11")
              ? "PNPM_CONFIG_OTP"
              : "NPM_CONFIG_OTP"]: "654321",
          },
          pmBinPath,
          signal,
        });
        expect.soft(result.exitCode).toBe(0);

        const publishRequests = registry.requests.filter(
          (request) =>
            request.method === "PUT" && request.pathname === "/pkg-a",
        );
        expect.soft(publishRequests).toEqual([
          expect.objectContaining({
            authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
            otpCode: "654321",
            statusCode: 201,
          }),
        ]);

        const packument = await fetchPackument(registry, "pkg-a");
        expect.soft(packument).toMatchObject({
          "dist-tags": {
            latest: "1.0.0",
          },
          name: "pkg-a",
          versions: {
            "0.0.1": {
              name: "pkg-a",
              version: "0.0.1",
            },
            "1.0.0": {
              name: "pkg-a",
              version: "1.0.0",
            },
          },
        });
      },
    );

    it("surfaces web-auth OTP publish failures in non-tty mode", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          auth: {
            packages: {
              "pkg-a": {
                token: CLIENT_AUTH_TOKEN,
                otp: { code: "654321", webAuth: true },
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      const result = await runCliCommand({
        command: "publish",
        cwd,
        pmBinPath,
        signal,
      });
      expect.soft(result.exitCode).toBe(1);
      expect.soft(result.stderr).toBe("");
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode
      expect.soft(publishRequests).toHaveLength(pm.name === "yarn 4" ? 2 : 1);
      expect.soft(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          headers: expect.objectContaining({
            ...(pm.name !== "yarn 4" && {
              "npm-auth-type": pm.name === "bun 1" ? "legacy" : "web",
              "npm-command": "publish",
            }),
          }),
          otpCode: undefined,
          statusCode: 401,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "0.0.1",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
        },
      });
      expect.soft(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("retries interactively after an OTP auth challenge", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(
        await createTestRegistry({
          packages: {
            "pkg-a": {
              versions: ["0.0.1"],
              tags: { latest: "0.0.1" },
            },
          },
          auth: {
            packages: {
              "pkg-a": {
                token: CLIENT_AUTH_TOKEN,
                otp: { code: "654321" },
              },
            },
          },
        }),
      );
      const cwd = await pm.gitdir(
        createPmContext(registry, pmBinPath, CLIENT_AUTH_TOKEN),
        createPkgAFixture(),
      );

      let output = "";
      let otpWritten = false;
      const result = await runCliCommand({
        command: "publish",
        cwd,
        onData(chunk, write) {
          output += chunk;
          if (
            !otpWritten &&
            (output.includes("Enter OTP:") ||
              output.includes("One-time password:"))
          ) {
            otpWritten = true;
            write("654321\r");
          }
        },
        pmBinPath,
        signal,
        tty: true,
      });
      expect.soft(result.exitCode).toBe(0);
      expect
        .soft(sanitizePublishLog(result.stdout, registry.url))
        .toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // We end up with 3 requests because the first non-tty attempt fails without OTP,
      // then the secon interactive attempt fails without OTP, prompts the user for the OTP and then sends the third (but second to its CLI invocation) request with the OTP.
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode so it has one extra.
      expect.soft(publishRequests).toHaveLength(pm.name === "yarn 4" ? 4 : 3);
      expect.soft(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect.soft(publishRequests.at(-2)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect.soft(publishRequests.at(-1)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: "654321",
          statusCode: 201,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect.soft(packument).toMatchObject({
        "dist-tags": {
          latest: "1.0.0",
        },
        name: "pkg-a",
        versions: {
          "0.0.1": {
            name: "pkg-a",
            version: "0.0.1",
          },
          "1.0.0": {
            name: "pkg-a",
            version: "1.0.0",
          },
        },
      });
    });
  });
});
