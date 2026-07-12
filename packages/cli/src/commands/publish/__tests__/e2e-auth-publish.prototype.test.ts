import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { setTimeout } from "node:timers/promises";
import { stripVTControlCharacters } from "node:util";
import { createGzip } from "node:zlib";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import {
  silenceLogsInBlock,
  testdir,
  type Fixture,
} from "@changesets/test-utils";
import { packTar, type TarSource } from "modern-tar/fs";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publish as publishCommand } from "../index.ts";

const mockedLogger = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@clack/prompts", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    log: mockedLogger,
  };
});

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

type TestRegistry = {
  host: string;
  requests: RegistryRequest[];
  url: string;
  [Symbol.asyncDispose](): Promise<void>;
};

type PmBins = Partial<Record<"npm" | "pnpm" | "yarn", string>>;

type PmCase = {
  name: string;
  bins: PmBins;
  testdir: (registry: TestRegistry, fixture?: Fixture) => Promise<string>;
};

type TarballContentEntry = {
  path: string;
  content: string | Uint8Array;
};

const TAR_ENTRY_MODE = 0o644;
const TAR_ENTRY_MTIME = new Date("1985-10-26T08:15:00.000Z");
const CLIENT_AUTH_TOKEN = "publ1sh-t0k3n";

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

function sanitizePublishLog(message: unknown, registryUrl: string) {
  return stripVTControlCharacters(String(message)).replaceAll(
    new URL(registryUrl).origin,
    "[registry-url]",
  );
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

function createNpmTestdir(packageManager: string) {
  return (registry: TestRegistry, fixture: Fixture = {}) =>
    testdir({
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
        `//${registry.host}/:_authToken=${CLIENT_AUTH_TOKEN}`,
      ].join("\n"),
      ...fixture,
    });
}

function createPnpmTestdir(packageManager: string) {
  return (registry: TestRegistry, fixture: Fixture = {}) =>
    testdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      ".npmrc": [
        `registry=${registry.url}`,
        `//${registry.host}/:_authToken=${CLIENT_AUTH_TOKEN}`,
      ].join("\n"),
      ...fixture,
    });
}

function createYarnBerryTestdir(packageManager: string) {
  return async (registry: TestRegistry, fixture: Fixture = {}) => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      ".yarnrc.yml": [
        `npmRegistryServer: "${registry.url}"`,
        `npmAuthToken: "${CLIENT_AUTH_TOKEN}"`,
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

async function usePackageManagerBins(signal: AbortSignal, bins: PmBins) {
  await using stack = new AbortableAsyncDisposableStack(signal);
  const root = stack.use(await createTempDir("changesets-pm-bins-"));
  const originalPath = process.env.PATH;
  stack.defer(() => {
    process.env.PATH = originalPath;
  });

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

  signal.throwIfAborted();
  process.env.PATH = originalPath
    ? `${root.path}${path.delimiter}${originalPath}`
    : root.path;

  const cleanup = stack.move();
  return {
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
  packages?: SeedRegistryState;
}): Promise<TestRegistry> {
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

const pmCases: PmCase[] = [
  {
    name: "npm 10",
    bins: { npm: "npm-10" },
    testdir: createNpmTestdir("npm@10.9.8"),
  },
  {
    name: "npm 11",
    bins: { npm: "npm-11" },
    testdir: createNpmTestdir("npm@11"),
  },
  // {
  //   name: "npm 12",
  //   bins: {},
  //   testdir: createNpmTestdir("npm@12.0.1"),
  //   todo: true,
  // },
  {
    name: "pnpm 10 + npm 10",
    bins: { npm: "npm-10", pnpm: "pnpm-10" },
    testdir: createPnpmTestdir("pnpm@10.0.0"),
  },
  {
    name: "pnpm 11",
    bins: { pnpm: "pnpm-11" },
    testdir: createPnpmTestdir("pnpm@11.9.0"),
  },
  // {
  //   name: "pnpm 12",
  //   bins: {},
  //   testdir: createPnpmTestdir("pnpm@12"),
  //   todo: true,
  // },
  {
    name: "yarn 4",
    bins: { yarn: "yarn-4" },
    testdir: createYarnBerryTestdir("yarn@4.17.0"),
  },
];

describe("publish command auth/publish e2e prototype", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe.each(pmCases)("$name", (pm) => {
    it("surfaces web-auth OTP publish failures in non-tty mode", async ({
      signal,
    }) => {
      await using stack = new AbortableAsyncDisposableStack(signal);
      stack.use(await usePackageManagerBins(signal, pm.bins));
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
                otp: { code: "654321", challenge: "web" },
              },
            },
          },
        }),
      );
      const cwd = await pm.testdir(registry, {
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
      });

      using _ = stubIsTTY(false);
      await expect(publishCommand({ cwd })).rejects.toMatchObject({
        code: 1,
        message: "The process exited with code: 1",
      });
      expect(
        mockedLogger.error.mock.calls.map((call) =>
          sanitizePublishLog(call[0], registry.url),
        ),
      ).toMatchSnapshot();

      const publishRequests = registry.requests.filter(
        (request) => request.method === "PUT" && request.pathname === "/pkg-a",
      );
      expect(publishRequests).toEqual([
        expect.objectContaining({
          authorization: `Bearer ${CLIENT_AUTH_TOKEN}`,
          forwarded: false,
          headers: expect.objectContaining({
            "npm-auth-type": "web",
            "npm-command": "publish",
          }),
          otpCode: undefined,
          statusCode: 401,
        }),
      ]);

      const response = await fetch(`${registry.url}pkg-a`, {
        signal: AbortSignal.timeout(5_000),
      });
      expect(response.status).toBe(200);

      const packument = await response.json();
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
      expect(git.tag).not.toHaveBeenCalled();
    });
  });
});
