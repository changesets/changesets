import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultConfig } from "@changesets/config";
import { gitdir, type Fixture } from "@changesets/test-utils";
import * as pty from "@lydell/node-pty";
import { exec } from "tinyexec";
import { AsyncDisposableStack } from "../../ponyfills/async-disposable-stack.ts";

const isWindows = process.platform === "win32";

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

export type PmBins = Partial<Record<"bun" | "npm" | "pnpm" | "yarn", string>>;

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
  name: string;
  bins: PmBins;
  gitdir: (context: PmGitdirContext, fixture?: Fixture) => Promise<string>;
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
  packageManager: "bun" | "npm" | "pnpm" | "yarn",
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

export async function getPmBinPath(signal: AbortSignal, bins: PmBins) {
  await using stack = new AbortableAsyncDisposableStack(signal);
  const root = stack.use(await createTempDir("changesets-pm-bins-"));

  for (const [command, packageName] of Object.entries(bins)) {
    const target = await resolvePackageBin(
      packageName,
      command as keyof PmBins,
    );
    const shimPath = path.join(
      root.path,
      isWindows ? `${command}.cmd` : command,
    );
    const shim =
      command === "bun"
        ? isWindows
          ? `@echo off\r\n"${target}" %*\r\n`
          : `#!/bin/sh\nexec ${JSON.stringify(target)} "$@"\n`
        : isWindows
          ? `@echo off\r\n"${process.execPath}" "${target}" %*\r\n`
          : `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(target)} "$@"\n`;
    await fs.writeFile(shimPath, shim);
    if (!isWindows) {
      await fs.chmod(shimPath, 0o755);
    }
  }

  const cleanup = stack.move();
  return {
    pmBinPath: root.path,
    async [Symbol.asyncDispose]() {
      await cleanup[Symbol.asyncDispose]();
    },
  };
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

function createNpmGitdir(packageName: string) {
  return async ({ registry }: PmGitdirContext, fixture: Fixture = {}) => {
    const packageManager = await resolvePackageManagerSpec("npm", packageName);

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
        registry && `registry=${registry.url}`,
        registry?.authToken &&
          `//${registry.host}/:_authToken=${registry.authToken}`,
      ].join("\n"),
      ...fixture,
    });
  };
}

function createPnpmGitdir(packageName: string) {
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

    return gitdir({
      "package.json": JSON.stringify({
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      ".npmrc": [
        registry && `registry=${registry.url}`,
        registry?.authToken &&
          `//${registry.host}/:_authToken=${registry.authToken}`,
        // pnpm 10 publish delegates to npm and prepends the active Node binary's
        // directory to PATH, which can otherwise pick the host-bundled npm.
        hasNpmShim ? `npm-path=${npmPath}` : undefined,
      ].join("\n"),
      ...fixture,
    });
  };
}

function createYarnBerryGitdir(packageName: string) {
  return async (
    { registry, pmBinPath }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    const packageManager = await resolvePackageManagerSpec("yarn", packageName);

    const cwd = await gitdir({
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
    });
    await exec("yarn", ["install"], {
      nodePath: false,
      nodeOptions: {
        cwd,
        env: await createPmBinEnv(cwd, pmBinPath),
      },
      throwOnError: true,
    });
    return cwd;
  };
}

function createBunGitdir(packageName: string) {
  return async (
    { registry, pmBinPath }: PmGitdirContext,
    fixture: Fixture = {},
  ) => {
    const packageManager = await resolvePackageManagerSpec("bun", packageName);

    const cwd = await gitdir({
      "package.json": JSON.stringify({
        name: "bun-workspace-root",
        packageManager,
        private: true,
        workspaces: ["packages/*"],
      }),
      ".npmrc": [
        registry && `registry=${registry.url}`,
        registry?.authToken &&
          `//${registry.host}/:_authToken=${registry.authToken}`,
      ].join("\n"),
      ...fixture,
    });
    await exec("bun", ["install", "--lockfile-only"], {
      nodePath: false,
      nodeOptions: {
        cwd,
        env: await createPmBinEnv(cwd, pmBinPath),
      },
      throwOnError: true,
    });
    return cwd;
  };
}

export const pmCases = [
  {
    name: "bun 1",
    bins: { bun: "bun-1" },
    gitdir: createBunGitdir("bun-1"),
  },
  {
    name: "npm 10",
    bins: { npm: "npm-10" },
    gitdir: createNpmGitdir("npm-10"),
  },
  {
    name: "npm 11",
    bins: { npm: "npm-11" },
    gitdir: createNpmGitdir("npm-11"),
  },
  {
    name: "npm 12",
    bins: { npm: "npm-12" },
    gitdir: createNpmGitdir("npm-12"),
  },
  {
    name: "pnpm 10 + npm 10",
    bins: { npm: "npm-10", pnpm: "pnpm-10" },
    gitdir: createPnpmGitdir("pnpm-10"),
  },
  {
    name: "pnpm 11",
    bins: { pnpm: "pnpm-11" },
    gitdir: createPnpmGitdir("pnpm-11"),
  },
  // {
  //   name: "pnpm 12",
  //   bins: { pnpm: "pnpm-12" },
  //   gitdir: createPnpmGitdir("pnpm-12"),
  // },
  {
    name: "yarn 4",
    bins: { yarn: "yarn-4" },
    gitdir: createYarnBerryGitdir("yarn-4"),
  },
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
