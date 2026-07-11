import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { getPackages } from "@manypkg/get-packages";
import { packTar, type TarSource } from "modern-tar/fs";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";

vi.mock("@changesets/git");

const cliPackageRoot = path.resolve(import.meta.dirname, "../../../..");

type RegistryRequest = {
  body?: unknown;
  bodyLength?: number;
  headers: http.IncomingHttpHeaders;
  method: string;
  packageName?: string;
  pathname: string;
  authorization?: string;
  otpCode?: string;
  forwarded: boolean;
  statusCode?: number;
};

type PackageAuthRequirement = {
  token: string;
  otp?: {
    code: string;
    challenge?: "web";
  };
};

type AuthProxyConfig = {
  packages?: Record<string, PackageAuthRequirement>;
  scopes?: Record<string, PackageAuthRequirement>;
};

type SeedPackageState = {
  tags: Record<string, string>;
  versions: string[];
};

type SeedRegistryState = Record<string, SeedPackageState>;

type TarballContentEntry = {
  path: string;
  content: string | Uint8Array;
};

const TAR_ENTRY_MODE = 0o644;
const TAR_ENTRY_MTIME = new Date("1985-10-26T08:15:00.000Z");

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPackageName(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0]?.startsWith("@") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0];
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

function stubIsTTY(value: boolean) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process.stdin,
    "isTTY",
  );
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    ...originalDescriptor,
    value,
  });
  return {
    [Symbol.dispose]() {
      if (originalDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", originalDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
    },
  };
}

async function readBody(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function tryParseJson(input: Buffer) {
  try {
    return JSON.parse(input.toString("utf8"));
  } catch {
    return undefined;
  }
}

async function captureBody(
  request: RegistryRequest,
  req: http.IncomingMessage,
) {
  const body = await readBody(req);
  request.bodyLength = body.byteLength;
  request.body = tryParseJson(body);
}

async function waitForRegistry(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for pnpr at ${url}`, {
    cause: lastError,
  });
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  if (!address || typeof address === "string") {
    throw new Error("Expected temporary server to listen on a TCP port");
  }
  return address.port;
}

async function createTempDir(prefix: string) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), prefix));
  return {
    path: directory,
    async [Symbol.asyncDispose]() {
      await fs.rm(directory, { force: true, recursive: true });
    },
  };
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
  ])
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
                pnprUrl
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
    await publishSeedPackage(
      pnprUrl,
      pnprToken,
      packageName,
      version,
      tags,
    );
  }
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
        publish: $all
        unpublish: $all
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

  const child = exec(
    "pnpm",
    [
      "exec",
      "pnpr",
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
        env: {
          ...process.env,
          pnpm_config_verify_deps_before_run: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    },
  );
  stack.defer(() => void child.kill());
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

async function proxyToPnpr(
  pnprUrl: string,
  pnprToken: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<number> {
  const upstream = new URL(req.url ?? "/", pnprUrl);

  return new Promise((resolve) => {
    const proxyReq = http.request(
      upstream,
      {
        method: req.method,
        headers: {
          ...req.headers,
          authorization: `Bearer ${pnprToken}`,
          host: upstream.host,
        },
      },
      (proxyRes) => {
        const statusCode = proxyRes.statusCode ?? 500;
        res.writeHead(statusCode, proxyRes.headers);
        void pipeline(proxyRes, res).then(
          () => resolve(statusCode),
          () => resolve(statusCode),
        );
      },
    );
    proxyReq.on("error", (error) => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
      resolve(502);
    });
    req.pipe(proxyReq);
  });
}

async function createAuthProxy(
  pnprUrl: string,
  pnprToken: string,
  authConfig: AuthProxyConfig = {},
) {
  const requests: RegistryRequest[] = [];

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://registry.test");
      const pathname = decodeURIComponent(url.pathname);
      const packageName = getPackageName(pathname);
      const authRequirement = getAuthRequirement(packageName, authConfig);
      const request: RegistryRequest = {
        headers: req.headers,
        method: req.method ?? "GET",
        packageName,
        pathname,
        authorization: firstHeader(req.headers.authorization),
        otpCode: firstHeader(req.headers["npm-otp"]),
        forwarded: false,
      };
      requests.push(request);

      if (request.method === "PUT" && authRequirement && packageName) {
        if (request.authorization !== `Bearer ${authRequirement.token}`) {
          await captureBody(request, req);
          request.statusCode = 401;
          res.writeHead(401, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unauthorized",
              code: "E401",
              reason: "Invalid authentication token.",
            }),
          );
          return;
        }

        if (
          authRequirement.otp &&
          request.otpCode !== authRequirement.otp.code
        ) {
          await captureBody(request, req);
          request.statusCode = 401;
          res.writeHead(401, {
            "content-type": "application/json",
            "www-authenticate": "OTP",
          });
          if (authRequirement.otp.challenge === "web") {
            const authId = randomUUID();
            const registryUrl = `http://${req.headers.host}/`;
            res.end(
              JSON.stringify({
                authUrl: new URL(`-/auth/cli/${authId}`, registryUrl).href,
                doneUrl: new URL(`-/v1/done?authId=${authId}`, registryUrl)
                  .href,
              }),
            );
          } else {
            res.end(
              JSON.stringify({
                error: "OTP required",
                code: "EOTP",
                reason:
                  "This operation requires a one-time password from your authenticator.",
              }),
            );
          }
          return;
        }
      }

      request.forwarded = true;
      request.statusCode = await proxyToPnpr(pnprUrl, pnprToken, req, res);
    })();
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
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

async function createTestRegistry(options?: {
  auth?: AuthProxyConfig;
  packages?: SeedRegistryState;
}) {
  await using stack = new AsyncDisposableStack();
  const pnpr = stack.use(await createPnprRegistry());
  const pnprToken = await createPnprUser(pnpr.url);
  for (const [packageName, state] of Object.entries(options?.packages ?? {})) {
    await seedPackage(pnpr.url, pnprToken, packageName, state);
  }
  const proxy = stack.use(
    await createAuthProxy(pnpr.url, pnprToken, options?.auth),
  );
  const cleanup = stack.move();

  return {
    host: new URL(proxy.url).host,
    requests: proxy.requests,
    url: proxy.url,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
}

describe("publish command auth/publish e2e prototype", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.skip("uses a programmable auth proxy in front of pnpr", async () => {
    await using registry = await createTestRegistry();
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      ".npmrc": [
        `registry=${registry.url}`,
        `//${registry.host}/:_authToken=publish-token`,
        "always-auth=true",
      ].join("\n"),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
        files: ["index.js"],
      }),
      "packages/pkg-a/index.js": "module.exports = 'pkg-a';\n",
      ".changeset/config.json": JSON.stringify(defaultConfig),
    });

    using _ = stubIsTTY(true);
    vi.mocked(git.tag).mockResolvedValue(true);

    await publishCommand({ cwd });

    expect(
      registry.requests.filter(
        (request) =>
          request.method === "PUT" && request.pathname === "/pkg-a",
      ),
    ).toEqual([
      expect.objectContaining({
        authorization: "Bearer publish-token",
        otpCode: "123456",
        forwarded: true,
        statusCode: expect.any(Number),
      }),
    ]);

    const response = await fetch(`${registry.url}pkg-a`);
    const packument = await response.json();
    expect(response.status).toBe(200);
    expect(packument).toMatchObject({
      name: "pkg-a",
      versions: {
        "1.0.0": {
          name: "pkg-a",
          version: "1.0.0",
        },
      },
    });
    expect(git.tag).toHaveBeenCalledWith("pkg-a@1.0.0", cwd);
  });
});
