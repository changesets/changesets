import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";
import { defaultConfig } from "@changesets/config";
import type { Fixture } from "@changesets/test-utils";
import * as pty from "@lydell/node-pty";
import { packTar, type TarSource } from "modern-tar/fs";
import { exec } from "tinyexec";
import { AsyncDisposableStack } from "../../ponyfills/async-disposable-stack.ts";

const isWindows = process.platform === "win32";
let testGitdir: ((fixture: Fixture) => Promise<string>) | undefined;

export function setTestGitdir(
  implementation: (fixture: Fixture) => Promise<string>,
) {
  testGitdir = implementation;
}

export const cliPackageRoot = path.resolve(import.meta.dirname, "../../..");
const oxcRegister = pathToFileURL(
  path.resolve(
    cliPackageRoot,
    "..",
    "..",
    "node_modules",
    "@oxc-node",
    "core",
    "register.mjs",
  ),
).href;

export type ExecResult = {
  exitCode: number | undefined;
  stderr: string;
  stdout: string;
};

export type PmBins = Partial<Record<"npm" | "pnpm" | "yarn", string>>;

export type TestRegistryConfig = {
  authToken?: string | null;
  host: string;
  url: string;
};

export type PmGitdirContext = {
  pmBinPath: string;
  registry?: TestRegistryConfig;
};

export type PmCase = {
  id: string;
  name: string;
  command: "npm" | "pnpm" | "yarn";
  bins: PmBins;
  fixture: (context: PmGitdirContext, fixture?: Fixture) => Promise<Fixture>;
  prepare: (cwd: string, context: PmGitdirContext) => Promise<void>;
  gitdir: (context: PmGitdirContext, fixture?: Fixture) => Promise<string>;
};

export type RegistryRequestRecord = {
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

export type AuthProxyConfig = {
  packages?: Record<string, PackageAuthRequirement>;
  scopes?: Record<string, PackageAuthRequirement>;
};

export type SeedPackageState = {
  tags: Record<string, string>;
  versions: string[];
};

export type RegistryMiddlewareContext = {
  pnpr: {
    fetch(request: Request): Promise<Response>;
    seedPackage(packageName: string, state: SeedPackageState): Promise<void>;
  };
  record: RegistryRequestRecord;
  request: Request;
};

export type RegistryMiddleware = (
  context: RegistryMiddlewareContext,
) => Promise<Response | undefined>;

export type TestRegistry = {
  host: string;
  pnprToken: string;
  requests: RegistryRequestRecord[];
  url: string;
  [Symbol.asyncDispose](): Promise<void>;
};

function disposeValue(value: AsyncDisposable | Disposable | null | undefined) {
  if (!value) {
    return;
  }
  if (Symbol.asyncDispose in value) {
    return value[Symbol.asyncDispose]();
  }
  return value[Symbol.dispose]();
}

export class AbortableAsyncDisposableStack extends AsyncDisposableStack {
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

export async function getFreePort() {
  const server = (await import("node:net")).createServer();
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve();
    });
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

export async function createTempDir(prefix: string) {
  const directory = await fs.mkdtemp(path.join(tmpdir(), prefix));
  return {
    path: directory,
    async [Symbol.asyncDispose]() {
      await fs.rm(directory, { force: true, recursive: true });
    },
  };
}

async function readInstalledPackageJson(packageName: string) {
  const packageRoot = path.join(cliPackageRoot, "node_modules", packageName);
  const packageJson: unknown = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
  );

  if (!packageJson || typeof packageJson !== "object") {
    throw new Error(`Could not read package.json from ${packageName}`);
  }

  return packageJson as Record<string, unknown>;
}

async function resolvePackageBin(packageName: string, command: keyof PmBins) {
  const packageJson = await readInstalledPackageJson(packageName);
  const packageRoot = path.join(cliPackageRoot, "node_modules", packageName);

  if (!("bin" in packageJson)) {
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

async function resolvePackageManagerSpec(
  packageManager: "npm" | "pnpm" | "yarn",
  packageName: string,
) {
  const packageJson = await readInstalledPackageJson(packageName);

  if (typeof packageJson.version !== "string") {
    throw new Error(`Could not resolve version from ${packageName}`);
  }

  return `${packageManager}@${packageJson.version}`;
}

export async function createPmBinEnv(
  cwd: string,
  pmBinPath: string,
  env: NodeJS.ProcessEnv = {},
) {
  const tempDir = path.join(cwd, ".tmp");
  await fs.mkdir(tempDir, { recursive: true });
  return {
    // Exercise normal user behavior regardless of where the tests run.
    // CI-specific tests can opt in through env when needed.
    CI: undefined,
    GITHUB_ACTIONS: undefined,
    // Required by ConPTY-launched processes on Windows.
    SystemRoot: process.env.SystemRoot,
    ...env,
    // pnpm 10 packs the package into TMPDIR and runs npm from there. If that is
    // /tmp/pkg and an unrelated /tmp/node_modules exists, npm can treat /tmp
    // as the project root and miss the fixture's .npmrc (and test registry).
    // Keeping TMPDIR inside cwd means npm still walks upward, but stops at the
    // fixture package.json and "accidentally" finds the equivalent .npmrc.
    TMPDIR: tempDir,
    PATH: process.env.PATH
      ? `${pmBinPath}${path.delimiter}${process.env.PATH}`
      : pmBinPath,
  };
}

export async function writePmBins(directory: string, bins: PmBins) {
  await fs.mkdir(directory, { recursive: true });
  for (const [command, packageName] of Object.entries(bins)) {
    const target = await resolvePackageBin(
      packageName,
      command as keyof PmBins,
    );
    const shimPath = path.join(
      directory,
      isWindows ? `${command}.cmd` : command,
    );
    const shim = isWindows
      ? `@echo off\r\n"${process.execPath}" "${target}" %*\r\n`
      : `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(target)} "$@"\n`;
    await fs.writeFile(shimPath, shim);
    if (!isWindows) {
      await fs.chmod(shimPath, 0o755);
    }
  }
}

export async function getPmBinPath(signal: AbortSignal, bins: PmBins) {
  await using stack = new AbortableAsyncDisposableStack(signal);
  const root = stack.use(await createTempDir("changesets-pm-bins-"));
  await writePmBins(root.path, bins);

  const cleanup = stack.move();
  return {
    pmBinPath: root.path,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
}

async function createTestGitdir(fixture: Fixture) {
  if (!testGitdir) {
    throw new Error("pm.gitdir can only be used from Vitest");
  }
  return testGitdir(fixture);
}

function execTty(
  command: string,
  args: string[],
  options: {
    onData?: (chunk: string, write: (data: string) => void) => void;
    signal?: AbortSignal;
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
      options.onData?.(chunk, (data) => child.write(data));
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
  });
}

export async function runCliCommand(options: {
  command: string;
  cwd: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string, write: (data: string) => void) => void;
  pmBinPath: string;
  signal?: AbortSignal;
  tty?: boolean;
}): Promise<ExecResult> {
  const args = [
    path.join(cliPackageRoot, "src", "index.ts"),
    options.command,
    ...(options.args ?? []),
  ];
  if (!globalThis.AsyncDisposableStack) {
    args.unshift("--import", oxcRegister);
  }
  const env = await createPmBinEnv(options.cwd, options.pmBinPath, options.env);
  if (options.tty) {
    return execTty(process.execPath, args, {
      onData: options.onData,
      signal: options.signal,
      nodeOptions: {
        cwd: options.cwd,
        env,
      },
    });
  }

  return exec(process.execPath, args, {
    nodePath: false,
    signal: options.signal,
    nodeOptions: {
      cwd: options.cwd,
      env,
    },
  });
}

function createNpmFixture(packageName: string) {
  return async ({ registry }: PmGitdirContext, fixture: Fixture = {}) => {
    const packageManager = await resolvePackageManagerSpec("npm", packageName);

    return {
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
        registry && `registry=${registry.url}`,
        registry?.authToken &&
          `//${registry.host}/:_authToken=${registry.authToken}`,
      ].join("\n"),
      ...fixture,
    };
  };
}

function createPnpmFixture(packageName: string) {
  return async (
    { pmBinPath, registry }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    const packageManager = await resolvePackageManagerSpec("pnpm", packageName);
    const npmPath = path.join(pmBinPath, isWindows ? "npm.cmd" : "npm");
    const hasNpmShim = await fs
      .access(npmPath)
      .then(() => true)
      .catch(() => false);

    return {
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": [
        "packages:",
        "  - packages/*",
        // pnpm 11 otherwise auto-installs before running commands from a
        // package subdirectory, where unpublished workspace deps cannot resolve.
        packageName === "pnpm-11" ? "verifyDepsBeforeRun: false" : undefined,
      ].join("\n"),
      ".npmrc": [
        registry && `registry=${registry.url}`,
        registry?.authToken &&
          `//${registry.host}/:_authToken=${registry.authToken}`,
        // pnpm 10 publish delegates to npm and prepends the active Node binary's
        // directory to PATH, which can otherwise pick the host-bundled npm.
        hasNpmShim ? `npm-path=${npmPath}` : undefined,
      ].join("\n"),
      ...fixture,
    };
  };
}

function createYarnBerryFixture(packageName: string) {
  return async ({ registry }: PmGitdirContext, fixture: Fixture = {}) => {
    const packageManager = await resolvePackageManagerSpec("yarn", packageName);

    return {
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "yarn.lock": "",
      ".yarnrc.yml": [
        registry && `npmRegistryServer: "${registry.url}"`,
        registry?.authToken && `npmAuthToken: "${registry.authToken}"`,
        // we want yarn.lock to be updated on yarn install below
        // this ensures that doesn't fail on CI where yarn.lock is often immutable/readonly
        "enableImmutableInstalls: false",
        "nodeLinker: node-modules",
        "unsafeHttpWhitelist:",
        '  - "127.0.0.1"',
      ].join("\n"),
      ...fixture,
    };
  };
}

async function prepareYarn(cwd: string, { pmBinPath }: PmGitdirContext) {
  await exec("yarn", ["install"], {
    nodePath: false,
    nodeOptions: {
      cwd,
      env: await createPmBinEnv(cwd, pmBinPath),
    },
    throwOnError: true,
  });
}

async function noPrepare() {}

function createPmGitdir(
  createFixture: PmCase["fixture"],
  prepare: PmCase["prepare"],
) {
  return async (context: PmGitdirContext, fixture: Fixture = {}) => {
    const cwd = await createTestGitdir(await createFixture(context, fixture));
    await prepare(cwd, context);
    return cwd;
  };
}

function definePmCase(options: Omit<PmCase, "gitdir">): PmCase {
  return {
    ...options,
    gitdir: createPmGitdir(options.fixture, options.prepare),
  };
}

export const pmCases = [
  definePmCase({
    id: "npm-10",
    name: "npm 10",
    command: "npm",
    bins: { npm: "npm-10" },
    fixture: createNpmFixture("npm-10"),
    prepare: noPrepare,
  }),
  definePmCase({
    id: "npm-11",
    name: "npm 11",
    command: "npm",
    bins: { npm: "npm-11" },
    fixture: createNpmFixture("npm-11"),
    prepare: noPrepare,
  }),
  definePmCase({
    id: "npm-12",
    name: "npm 12",
    command: "npm",
    bins: { npm: "npm-12" },
    fixture: createNpmFixture("npm-12"),
    prepare: noPrepare,
  }),
  definePmCase({
    id: "pnpm-10",
    name: "pnpm 10 + npm 10",
    command: "pnpm",
    bins: { npm: "npm-10", pnpm: "pnpm-10" },
    fixture: createPnpmFixture("pnpm-10"),
    prepare: noPrepare,
  }),
  definePmCase({
    id: "pnpm-11",
    name: "pnpm 11",
    command: "pnpm",
    bins: { pnpm: "pnpm-11" },
    fixture: createPnpmFixture("pnpm-11"),
    prepare: noPrepare,
  }),
  // definePmCase({
  //   id: "pnpm-12",
  //   name: "pnpm 12",
  //   command: "pnpm",
  //   bins: { pnpm: "pnpm-12" },
  //   fixture: createPnpmFixture("pnpm-12"),
  //   prepare: noPrepare,
  // }),
  definePmCase({
    id: "yarn-4",
    name: "yarn 4",
    command: "yarn",
    bins: { yarn: "yarn-4" },
    fixture: createYarnBerryFixture("yarn-4"),
    prepare: prepareYarn,
  }),
] as const satisfies ReadonlyArray<PmCase>;

export function createPkgAFixture(
  options: { version?: string; pre?: string } = {},
): Fixture {
  const fixture: Fixture = {
    "packages/pkg-a/package.json": JSON.stringify({
      name: "pkg-a",
      version: options.version ?? "1.0.0",
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

  if (options.pre) {
    fixture[".changeset/pre.json"] = JSON.stringify({
      changesets: [],
      initialVersions: {},
      mode: "pre",
      tag: options.pre,
    });
  }

  return fixture;
}

type TarballContentEntry = {
  path: string;
  content: string | Uint8Array;
};

const TAR_ENTRY_MODE = 0o644;
const TAR_ENTRY_MTIME = new Date("1985-10-26T08:15:00.000Z");

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

function createWebRequest(req: http.IncomingMessage) {
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
        await writeResponse(res, await handler(createWebRequest(req)));
      } catch {
        await writeResponse(
          res,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        );
      }
    })();
  });
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

export async function createPnprUser(pnprUrl: string) {
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

export function getPackageTarballFilename(
  packageName: string,
  version: string,
) {
  return `${packageName.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

export async function packTarball(entries: TarballContentEntry[]) {
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

export async function createPnprRegistry(options?: {
  publicUrl?: string;
  rootDir?: string;
}) {
  await using stack = new AsyncDisposableStack();
  const temporaryRoot = options?.rootDir
    ? undefined
    : stack.use(await createTempDir("changesets-pnpr-"));
  const root = options?.rootDir ?? temporaryRoot!.path;
  const storage = path.join(root, "storage");
  const config = path.join(root, "pnpr.yaml");
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}/`;
  await fs.mkdir(storage, { recursive: true });
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
        options?.publicUrl ?? url,
      ],
      {
        nodeOptions: {
          cwd: cliPackageRoot,
          stdio: ["ignore", "pipe", "pipe"],
        },
      },
    ),
  );
  const pnprProcess = execResult.child.process!;
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

export async function createAuthProxy(
  pnprUrl: string,
  pnprToken: string,
  config: {
    auth?: AuthProxyConfig;
    middleware?: RegistryMiddleware;
    port?: number;
  } = {},
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

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(config.port ?? 0, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve();
    });
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

export async function createTestRegistry(options?: {
  auth?: AuthProxyConfig | ((pnprToken: string) => AuthProxyConfig | undefined);
  middleware?: RegistryMiddleware;
  packages?: Record<string, SeedPackageState>;
  pnprToken?: string;
  proxyPort?: number;
  rootDir?: string;
}): Promise<TestRegistry> {
  await using stack = new AsyncDisposableStack();
  const publicUrl = options?.proxyPort
    ? `http://127.0.0.1:${options.proxyPort}/`
    : undefined;
  const pnpr = stack.use(
    await createPnprRegistry({
      publicUrl,
      rootDir: options?.rootDir,
    }),
  );
  const pnprToken = options?.pnprToken ?? (await createPnprUser(pnpr.url));
  for (const [packageName, state] of Object.entries(options?.packages ?? {})) {
    await seedPackage(pnpr.url, pnprToken, packageName, state);
  }
  const auth =
    typeof options?.auth === "function"
      ? options.auth(pnprToken)
      : options?.auth;
  const proxy = stack.use(
    await createAuthProxy(pnpr.url, pnprToken, {
      auth,
      middleware: options?.middleware,
      port: options?.proxyPort,
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
