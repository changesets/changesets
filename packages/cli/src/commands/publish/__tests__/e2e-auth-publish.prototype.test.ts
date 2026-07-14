import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import { createGzip } from "node:zlib";
import { defaultConfig } from "@changesets/config";
import { tagExists } from "@changesets/git";
import { gitdir, type Fixture } from "@changesets/test-utils";
import { packTar, type TarSource } from "modern-tar/fs";
import * as pty from "node-pty";
import { exec } from "tinyexec";
import { describe, expect, it } from "vitest";

const cliPackageRoot = path.resolve(import.meta.dirname, "../../../..");

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

type PmBins = Partial<Record<"npm" | "pnpm" | "yarn", string>>;

type PmGitdirContext = {
  authToken?: string | null;
  pmBinPath: string;
  registry: TestRegistry;
};

type PmCase = {
  name: string;
  bins: PmBins;
  gitdir: (context: PmGitdirContext, fixture?: Fixture) => Promise<string>;
};

type TarballContentEntry = {
  path: string;
  content: string | Uint8Array;
};

type ExecResult = {
  exitCode: number | undefined;
  stderr: string;
  stdout: string;
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

function sanitizePublishLog(message: unknown, registryUrl: string) {
  return stripVTControlCharacters(String(message)).replaceAll(
    new URL(registryUrl).origin,
    "[registry-url]",
  );
}

async function runPublishCli(options: {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  pmBinPath: string;
  signal?: AbortSignal;
  stdin?: string;
  tty?: boolean;
}): Promise<ExecResult> {
  const args = [path.join(cliPackageRoot, "src", "index.ts"), "publish"];
  const env = createPmBinEnv(options.pmBinPath, options.env);
  if (options.tty) {
    return execTty(process.execPath, args, {
      signal: options.signal,
      stdin: options.stdin,
      nodeOptions: {
        cwd: options.cwd,
        env,
      },
    });
  }

  return exec(process.execPath, args, {
    signal: options.signal,
    stdin: options.stdin,
    nodeOptions: {
      cwd: options.cwd,
      env,
    },
  });
}

function execTty(
  command: string,
  args: string[],
  options: {
    signal?: AbortSignal;
    stdin?: string;
    nodeOptions: {
      cwd: string;
      env?: NodeJS.ProcessEnv;
    };
  },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(options.signal.reason);
      return;
    }
    let done = false;
    let output = "";
    const child = pty.spawn(command, args, {
      cols: 80,
      rows: 30,
      cwd: options.nodeOptions.cwd,
      env: options.nodeOptions.env,
    });
    const data = child.onData((chunk) => {
      output += chunk;
    });

    const cleanup = () => {
      if (done) {
        return;
      }
      done = true;
      data.dispose();
      exit.dispose();
      options.signal?.removeEventListener("abort", abort);
    };

    const abort = () => {
      cleanup();
      child.kill();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(options.signal?.reason);
    };

    const exit = child.onExit(({ exitCode }) => {
      cleanup();
      resolve({ exitCode, stderr: "", stdout: output });
    });

    options.signal?.addEventListener("abort", abort, { once: true });
    if (typeof options.stdin === "string") {
      child.write(options.stdin.replaceAll("\n", "\r"));
    }
  });
}

async function fetchPackument(registry: TestRegistry, packageName: string) {
  const response = await fetch(
    new URL(encodeURIComponent(packageName), registry.url),
    {
      signal: AbortSignal.timeout(5_000),
    },
  );
  expect(response.status).toBe(200);
  return response.json();
}

function disposeValue(value: AsyncDisposable | Disposable | null | undefined) {
  if (!value) {
    return;
  }
  if (Symbol.asyncDispose in value) {
    return value[Symbol.asyncDispose]();
  }
  return value[Symbol.dispose]();
}

class AbortableAsyncDisposableStack extends AsyncDisposableStack {
  #signal: AbortSignal;

  #abort = () => {
    void this.disposeAsync();
  };

  constructor(signal: AbortSignal) {
    super();
    this.#signal = signal;
    signal.throwIfAborted();
    signal.addEventListener("abort", this.#abort, { once: true });
  }

  override use<T extends AsyncDisposable | Disposable | null | undefined>(
    value: T,
  ): T {
    if (this.#signal.aborted) {
      void disposeValue(value);
    }
    this.#signal.throwIfAborted();
    return super.use(value);
  }

  override adopt<T>(
    value: T,
    onDisposeAsync: (value: T) => PromiseLike<void> | void,
  ) {
    if (this.#signal.aborted) {
      void onDisposeAsync(value);
    }
    this.#signal.throwIfAborted();
    return super.adopt(value, onDisposeAsync);
  }

  override defer(onDisposeAsync: () => PromiseLike<void> | void): void {
    if (this.#signal.aborted) {
      void onDisposeAsync();
    }
    this.#signal.throwIfAborted();
    return super.defer(onDisposeAsync);
  }

  override async disposeAsync() {
    this.#signal.removeEventListener("abort", this.#abort);
    await super.disposeAsync();
  }

  override async [Symbol.asyncDispose]() {
    await this.disposeAsync();
  }
}

function createNpmGitdir(packageManager: string) {
  return (
    { registry, authToken = registry.pnprToken }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    return gitdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": {
            workspaces: ["packages/*"],
          },
        },
      }),
      ".npmrc": [
        `registry=${registry.url}`,
        authToken && `//${registry.host}/:_authToken=${authToken}`,
      ].join("\n"),
      ...fixture,
    });
  };
}

function createPnpmGitdir(packageManager: string) {
  return (
    { registry, authToken = registry.pnprToken }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    return gitdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      ".npmrc": [
        `registry=${registry.url}`,
        authToken && `//${registry.host}/:_authToken=${authToken}`,
      ].join("\n"),
      ...fixture,
    });
  };
}

function createYarnBerryGitdir(packageManager: string) {
  return async (
    { registry, authToken = registry.pnprToken, pmBinPath }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    const cwd = await gitdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      ".yarnrc.yml": [
        `npmRegistryServer: "${registry.url}"`,
        authToken && `npmAuthToken: "${authToken}"`,
        // we want yarn.lock to be updated on yarn install below
        // this ensures that doesn't fail on CI where yarn.lock is often immutable/readonly
        "enableImmutableInstalls: false",
        "nodeLinker: node-modules",
        "unsafeHttpWhitelist:",
        '  - "127.0.0.1"',
      ].join("\n"),
      ...fixture,
    });
    await exec("yarn", ["install"], {
      nodeOptions: {
        cwd,
        env: createPmBinEnv(pmBinPath),
      },
      throwOnError: true,
    });
    return cwd;
  };
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

async function resolvePackageBin(packageName: string, command: keyof PmBins) {
  const packageRoot = path.join(cliPackageRoot, "node_modules", packageName);
  const packageJson: unknown = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
  );

  if (
    !packageJson ||
    typeof packageJson !== "object" ||
    !("bin" in packageJson)
  ) {
    throw new Error(`Could not resolve ${command} bin from ${packageName}`);
  }

  const bin =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : packageJson.bin &&
          typeof packageJson.bin === "object" &&
          command in packageJson.bin
        ? (packageJson.bin as Record<keyof PmBins, string>)[command]
        : undefined;

  if (!bin) {
    throw new Error(`Could not resolve ${command} bin from ${packageName}`);
  }
  return path.join(packageRoot, bin);
}

function createPmBinEnv(pmBinPath: string, env: NodeJS.ProcessEnv = {}) {
  return {
    ...env,
    PATH: process.env.PATH
      ? `${pmBinPath}${path.delimiter}${process.env.PATH}`
      : pmBinPath,
  };
}

async function getPmBinPath(signal: AbortSignal, bins: PmBins) {
  await using stack = new AbortableAsyncDisposableStack(signal);
  const root = stack.use(await createTempDir("changesets-pm-bins-"));

  for (const [command, packageName] of Object.entries(bins)) {
    const target = await resolvePackageBin(
      packageName,
      command as keyof PmBins,
    );
    const shimPath = path.join(root.path, command);
    const shim = `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(target)} "$@"\n`;
    await fs.writeFile(shimPath, shim);
    await fs.chmod(shimPath, 0o755);
  }

  const cleanup = stack.move();
  return {
    pmBinPath: root.path,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
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

const pkgAFixture = {
  "packages/pkg-a/package.json": JSON.stringify({
    name: "pkg-a",
    version: "1.0.0",
    description: "",
    files: ["index.js"],
    license: "MIT",
    type: "module",
  }),
  "packages/pkg-a/index.js": "export default 'pkg-a';\n",
  ".changeset/config.json": JSON.stringify({
    ...defaultConfig,
    access: "public",
  }),
};

const pmCases = [
  {
    name: "npm 10",
    bins: { npm: "npm-10" },
    gitdir: createNpmGitdir("npm@10.9.8"),
  },
  {
    name: "npm 11",
    bins: { npm: "npm-11" },
    gitdir: createNpmGitdir("npm@11"),
  },
  // {
  //   name: "npm 12",
  //   bins: {},
  //   gitdir: createNpmGitdir("npm@12.0.1"),
  //   todo: true,
  // },
  {
    name: "pnpm 10 + npm 10",
    bins: { npm: "npm-10", pnpm: "pnpm-10" },
    gitdir: createPnpmGitdir("pnpm@10.0.0"),
  },
  {
    name: "pnpm 11",
    bins: { pnpm: "pnpm-11" },
    gitdir: createPnpmGitdir("pnpm@11.13.0"),
  },
  // {
  //   name: "pnpm 12",
  //   bins: {},
  //   gitdir: createPnpmGitdir("pnpm@12"),
  //   todo: true,
  // },
  {
    name: "yarn 4",
    bins: { yarn: "yarn-4" },
    gitdir: createYarnBerryGitdir("yarn@4.17.0"),
  },
] as const satisfies ReadonlyArray<PmCase>;

describe("publish command auth/publish e2e prototype", () => {
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
      const cwd = await pm.gitdir({ pmBinPath, registry }, pkgAFixture);

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      expect(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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

    it("publishes a first version of a package", async ({ signal }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      const { pmBinPath } = stack.use(await getPmBinPath(signal, pm.bins));
      const registry = stack.use(await createTestRegistry());
      const cwd = await pm.gitdir({ pmBinPath, registry }, pkgAFixture);

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      expect(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          otpCode: undefined,
          statusCode: 201,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
        { authToken: BAD_CLIENT_AUTH_TOKEN, pmBinPath, registry },
        pkgAFixture,
      );

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("");
      expect(sanitizePublishLog(result.stdout, registry.url)).toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${BAD_CLIENT_AUTH_TOKEN}`,
          statusCode: 401,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
      expect(packument).not.toMatchObject({
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
        { authToken: null, pmBinPath, registry },
        pkgAFixture,
      );

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("");
      expect(sanitizePublishLog(result.stdout, registry.url)).toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(
        publishRequests.map(({ authorization, statusCode }) => ({
          authorization,
          statusCode,
        })),
      ).toEqual(
        // Most package managers fail locally when no token is configured. pnpm 11
        // still sends the publish request and lets the registry reject it.
        pm.name === "pnpm 11"
          ? [{ authorization: undefined, statusCode: 401 }]
          : [],
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
      expect(packument).not.toMatchObject({
        versions: {
          "1.0.0": expect.anything(),
        },
      });
    });

    it("skips already-published version publish errors", async ({ signal }) => {
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
      const cwd = await pm.gitdir({ pmBinPath, registry }, pkgAFixture);

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(result.exitCode).toBe(0);
      expect(sanitizePublishLog(result.stdout, registry.url)).not.toContain(
        "Published pkg-a@1.0.0!",
      );
      await expect(tagExists("pkg-a@1.0.0", cwd)).resolves.toBe(false);
      expect(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${registry.pnprToken}`,
          statusCode: 403,
        }),
      ]);

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
          { authToken: CLIENT_AUTH_TOKEN, pmBinPath, registry },
          pkgAFixture,
        );

        const result = await runPublishCli({
          cwd,
          env: {
            [pm.name.startsWith("pnpm 11")
              ? "PNPM_CONFIG_OTP"
              : "NPM_CONFIG_OTP"]: "654321",
          },
          pmBinPath,
          signal,
        });
        expect(result.exitCode).toBe(0);

        const publishRequests = registry.requests.filter(
          (request) =>
            request.method === "PUT" && request.pathname === "/pkg-a",
        );
        expect(publishRequests).toEqual([
          expect.objectContaining({
            authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
            otpCode: "654321",
            statusCode: 201,
          }),
        ]);

        const packument = await fetchPackument(registry, "pkg-a");
        expect(packument).toMatchObject({
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
        { authToken: CLIENT_AUTH_TOKEN, pmBinPath, registry },
        pkgAFixture,
      );

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("");
      expect(sanitizePublishLog(result.stdout, registry.url)).toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode
      expect(publishRequests).toHaveLength(pm.name === "yarn 4" ? 2 : 1);
      expect(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          headers: expect.objectContaining({
            ...(pm.name !== "yarn 4" && {
              "npm-auth-type": "web",
              "npm-command": "publish",
            }),
          }),
          otpCode: undefined,
          statusCode: 401,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
      expect(packument).not.toMatchObject({
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
        { authToken: CLIENT_AUTH_TOKEN, pmBinPath, registry },
        pkgAFixture,
      );

      const result = await runPublishCli({
        cwd,
        pmBinPath,
        signal,
        stdin: "654321\n",
        tty: true,
      });
      expect(result.exitCode).toBe(0);

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      // We end up with 3 requests because the first non-tty attempt fails without OTP,
      // then the secon interactive attempt fails without OTP, prompts the user for the OTP and then sends the third (but second to its CLI invocation) request with the OTP.
      // Yarn 4 retries with our fake otp code provided to it in the stdin in the non-tty mode so it has one extra.
      expect(publishRequests).toHaveLength(pm.name === "yarn 4" ? 4 : 3);
      expect(publishRequests[0]).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect(publishRequests.at(-2)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: undefined,
          statusCode: 401,
        }),
      );
      expect(publishRequests.at(-1)).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          otpCode: "654321",
          statusCode: 201,
        }),
      );

      const packument = await fetchPackument(registry, "pkg-a");
      expect(packument).toMatchObject({
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
