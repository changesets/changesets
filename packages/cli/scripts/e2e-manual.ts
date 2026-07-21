import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { defaultConfig } from "@changesets/config";
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import { exec } from "tinyexec";
import {
  cliPackageRoot,
  createTestRegistry,
  getFreePort,
  pmCases,
  writePmBins,
  type PmCase,
  type AuthProxyConfig,
  type RegistryMiddleware,
  type RegistryRequestRecord,
  type TestRegistry,
} from "../src/commands/__tests__/e2e-utils.ts";

export const MANUAL_PUBLISH_DELAY_MS = 3_000;
export const MANUAL_OTP_CODE = "123321";

type ManualFixture = Record<string, string>;

export type ManualOtpMode = "disabled" | "always" | "once";

type ManualConfig = {
  otpMode?: ManualOtpMode;
  // Kept so sandboxes created before otpMode can still restart pnpr.
  otpRequired?: boolean;
  pmId: string;
  proxyPort: number;
};

const manualPackageNames = [
  "pkg-a",
  "pkg-b",
  "pkg-c",
  "pkg-d",
  "pkg-e",
  "pkg-f",
  "pkg-g",
  "pkg-h",
  "pkg-i",
];

export function createManualAuthConfig(
  token: string,
  otpMode: Exclude<ManualOtpMode, "disabled"> = "always",
): AuthProxyConfig {
  return {
    packages: Object.fromEntries(
      manualPackageNames.map((packageName) => [
        packageName,
        {
          token,
          otp: {
            allowMissingAfterSuccess: otpMode === "once",
            code: MANUAL_OTP_CODE,
          },
        },
      ]),
    ),
  };
}

function createPackageFixture(
  name: string,
  dependencies?: Record<string, string>,
): ManualFixture {
  return {
    [`packages/${name}/package.json`]: `${JSON.stringify(
      {
        name,
        version: "1.0.0",
        description: "",
        files: ["index.js"],
        license: "MIT",
        type: "module",
        ...(dependencies && { dependencies }),
      },
      undefined,
      2,
    )}\n`,
    [`packages/${name}/index.js`]: `export default ${JSON.stringify(name)};\n`,
  };
}

export function createDefaultManualFixture(): ManualFixture {
  return {
    ...createPackageFixture("pkg-a"),
    ...createPackageFixture("pkg-b"),
    ...createPackageFixture("pkg-c"),
    ...createPackageFixture("pkg-d", { "pkg-a": "^1.0.0" }),
    ...createPackageFixture("pkg-e", { "pkg-b": "^1.0.0" }),
    ...createPackageFixture("pkg-f", { "pkg-c": "^1.0.0" }),
    ...createPackageFixture("pkg-g", { "pkg-d": "^1.0.0" }),
    ...createPackageFixture("pkg-h", { "pkg-e": "^1.0.0" }),
    ...createPackageFixture("pkg-i", { "pkg-f": "^1.0.0" }),
    ".changeset/config.json": `${JSON.stringify(
      { ...defaultConfig, access: "public" },
      undefined,
      2,
    )}\n`,
    ".gitignore": ".pnpr/\n.tmp/\nnode_modules/\n",
  };
}

export const manualFixtures = {
  default: createDefaultManualFixture,
} as const;

export function isPackagePublishRequest(record: RegistryRequestRecord) {
  return record.method === "PUT" && !record.pathname.startsWith("/-/");
}

export function createPublishDelayMiddleware(options?: {
  delayMs?: number;
  onDelay?: (record: RegistryRequestRecord) => void;
  wait?: (delayMs: number) => Promise<unknown>;
}): RegistryMiddleware {
  const delayMs = options?.delayMs ?? MANUAL_PUBLISH_DELAY_MS;
  const wait = options?.wait ?? setTimeout;

  return async ({ pnpr, record, request }) => {
    if (isPackagePublishRequest(record)) {
      options?.onDelay?.(record);
      await wait(delayMs);
    }
    return pnpr.fetch(request);
  };
}

function getManualConfigPath(cwd: string) {
  return path.join(cwd, ".pnpr", "manual.json");
}

function getTokenPath(cwd: string) {
  return path.join(cwd, ".pnpr", "token");
}

async function readOptionalFile(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function readManualConfig(cwd: string): Promise<ManualConfig> {
  const config: unknown = JSON.parse(
    await fs.readFile(getManualConfigPath(cwd), "utf8"),
  );
  if (
    !config ||
    typeof config !== "object" ||
    !("pmId" in config) ||
    typeof config.pmId !== "string" ||
    !("proxyPort" in config) ||
    typeof config.proxyPort !== "number" ||
    ("otpMode" in config &&
      config.otpMode !== "disabled" &&
      config.otpMode !== "always" &&
      config.otpMode !== "once") ||
    ("otpRequired" in config && typeof config.otpRequired !== "boolean")
  ) {
    throw new Error("Invalid manual e2e configuration");
  }
  return config as ManualConfig;
}

function getManualOtpMode(config: ManualConfig): ManualOtpMode {
  return config.otpMode ?? (config.otpRequired ? "always" : "disabled");
}

async function startManualRegistry(cwd: string): Promise<TestRegistry> {
  const config = await readManualConfig(cwd);
  const otpMode = getManualOtpMode(config);
  const tokenPath = getTokenPath(cwd);
  const savedToken = (await readOptionalFile(tokenPath))?.trim();
  const registry = await createTestRegistry({
    auth:
      otpMode !== "disabled"
        ? (pnprToken) => createManualAuthConfig(pnprToken, otpMode)
        : undefined,
    middleware: createPublishDelayMiddleware({
      onDelay(record) {
        console.log(
          `[proxy] delaying ${record.packageName ?? record.pathname} publish by ${MANUAL_PUBLISH_DELAY_MS / 1_000}s`,
        );
      },
    }),
    pnprToken: savedToken || undefined,
    proxyPort: config.proxyPort,
    rootDir: path.join(cwd, ".pnpr"),
  });

  if (!savedToken) {
    await fs.writeFile(tokenPath, `${registry.pnprToken}\n`, { mode: 0o600 });
  }
  return registry;
}

function waitForTermination() {
  return new Promise<void>((resolve) => {
    const stop = () => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

export async function serveManualSandbox(cwd = process.cwd()) {
  await using registry = await startManualRegistry(cwd);
  console.log(`pnpr proxy listening at ${registry.url}`);
  console.log("Press Ctrl-C to stop it; the sandbox will be preserved.");
  await waitForTermination();
}

async function writeFixture(cwd: string, fixture: Record<string, unknown>) {
  for (const [relativePath, contents] of Object.entries(fixture)) {
    if (
      typeof contents !== "string" &&
      !Buffer.isBuffer(contents) &&
      !(contents instanceof Uint8Array)
    ) {
      throw new Error(`Unsupported fixture entry: ${relativePath}`);
    }
    const filePath = path.join(cwd, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents);
  }
}

function getOxcRegister() {
  return path.resolve(
    cliPackageRoot,
    "..",
    "..",
    "node_modules",
    "@oxc-node",
    "core",
    "register.mjs",
  );
}

function createChangesetRunner(pmBinPath: string) {
  const cliEntry = path.join(cliPackageRoot, "src", "index.ts");
  const oxcRegister = getOxcRegister();
  return `
import { once } from "node:events";
import path from "node:path";
import { spawn } from "node:child_process";

const child = spawn(
  ${JSON.stringify(process.execPath)},
  ["--import", ${JSON.stringify(pathToFileURL(oxcRegister).href)}, ${JSON.stringify(cliEntry)}, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PATH: process.env.PATH
        ? ${JSON.stringify(pmBinPath)} + path.delimiter + process.env.PATH
        : ${JSON.stringify(pmBinPath)},
    },
    stdio: "inherit",
  },
);

const [code, signal] = await once(child, "exit");
if (signal) process.kill(process.pid, signal);
else process.exitCode = code ?? 1;
`.trimStart();
}

function createPnprRunner() {
  return `
import { serveManualSandbox } from ${JSON.stringify(import.meta.url)};

await serveManualSandbox(process.cwd());
`.trimStart();
}

async function initializeGit(cwd: string) {
  await exec("git", ["init"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["config", "gc.auto", "0"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["config", "maintenance.auto", "false"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["config", "user.email", "manual-e2e@example.com"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["config", "user.name", "Changesets manual e2e"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["add", "."], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
  await exec("git", ["commit", "-m", "initial fixture"], {
    nodeOptions: { cwd },
    throwOnError: true,
  });
}

function withManualScripts(
  fixture: Record<string, unknown>,
  pmBinPath: string,
) {
  const packageJson = JSON.parse(String(fixture["package.json"]));
  const node = JSON.stringify(process.execPath);
  fixture["package.json"] = `${JSON.stringify(
    {
      ...packageJson,
      scripts: {
        changeset: `${node} .manual/changeset.mjs`,
        pnpr: `${node} --import ${pathToFileURL(getOxcRegister()).href} .manual/pnpr.mjs`,
      },
    },
    undefined,
    2,
  )}\n`;
  fixture[".manual/changeset.mjs"] = createChangesetRunner(pmBinPath);
  fixture[".manual/pnpr.mjs"] = createPnprRunner();
  return fixture;
}

export async function createManualProjectFixture(
  pm: PmCase,
  context: Parameters<PmCase["fixture"]>[0],
) {
  return withManualScripts(
    await pm.fixture(context, manualFixtures.default()),
    context.pmBinPath,
  );
}

async function createManualSandbox(pm: PmCase, otpMode: ManualOtpMode) {
  const cwd = await fs.mkdtemp(path.join(tmpdir(), "changesets-manual-"));
  const pmBinPath = path.join(cwd, ".manual", "bin");
  await writePmBins(pmBinPath, pm.bins);
  const proxyPort = await getFreePort();
  await fs.mkdir(path.join(cwd, ".pnpr"), { recursive: true });
  await fs.writeFile(
    getManualConfigPath(cwd),
    `${JSON.stringify({ otpMode, pmId: pm.id, proxyPort }, undefined, 2)}\n`,
  );

  const registry = await startManualRegistry(cwd);
  try {
    const context = {
      pmBinPath,
      registry: {
        authToken: registry.pnprToken,
        host: registry.host,
        url: registry.url,
      },
    };
    const fixture = await createManualProjectFixture(pm, context);
    await writeFixture(cwd, fixture);
    await pm.prepare(cwd, context);
    await initializeGit(cwd);
    return {
      cwd,
      pm,
      registry,
      async [Symbol.asyncDispose]() {
        await registry[Symbol.asyncDispose]();
      },
    };
  } catch (error) {
    await registry[Symbol.asyncDispose]();
    throw error;
  }
}

function getPublishCommand(pm: PmCase) {
  switch (pm.command) {
    case "npm":
      return "npm run changeset -- publish";
    case "pnpm":
      return "pnpm changeset publish";
    case "yarn":
      return "yarn changeset publish";
  }
}

async function choosePackageManager(pmId: string | undefined) {
  if (pmId) {
    const pm = pmCases.find((candidate) => candidate.id === pmId);
    if (!pm) {
      throw new Error(
        `Unknown package manager ${JSON.stringify(pmId)}. Expected one of: ${pmCases.map((candidate) => candidate.id).join(", ")}`,
      );
    }
    return pm;
  }

  const selected = await select({
    message: "Which package manager should the sandbox use?",
    options: pmCases.map((pm) => ({ label: pm.name, value: pm.id })),
  });
  if (isCancel(selected)) {
    cancel("Canceled.");
    process.exitCode = 1;
    return;
  }
  return pmCases.find((pm) => pm.id === selected)!;
}

async function chooseOtpMode(
  requestedMode: string | undefined,
  otpRequired: boolean | undefined,
): Promise<ManualOtpMode | undefined> {
  if (
    requestedMode != null &&
    requestedMode !== "disabled" &&
    requestedMode !== "always" &&
    requestedMode !== "once"
  ) {
    throw new Error(
      `Unknown OTP mode ${JSON.stringify(requestedMode)}. Expected disabled, always, or once.`,
    );
  }
  if (requestedMode != null) return requestedMode;
  if (otpRequired) return "always";

  const selected = await select({
    message: "What OTP behavior should publishing use?",
    options: [
      { label: "No OTP", value: "disabled" },
      { label: "Require OTP for every publish", value: "always" },
      { label: "Require OTP once", value: "once" },
    ],
  });
  if (isCancel(selected)) {
    cancel("Canceled.");
    process.exitCode = 1;
    return;
  }
  return selected;
}

async function main() {
  const { values } = parseArgs({
    options: {
      otp: { type: "boolean" },
      "otp-mode": { type: "string" },
      pm: { type: "string" },
    },
    strict: true,
  });
  intro("Changesets manual publish e2e");
  const pm = await choosePackageManager(values.pm);
  if (!pm) return;
  const otpMode = await chooseOtpMode(values["otp-mode"], values.otp);
  if (otpMode == null) return;

  log.info("Creating sandbox and starting pnpr...");
  const sandbox = await createManualSandbox(pm, otpMode);
  const publishCommand = getPublishCommand(pm);
  try {
    log.success(`Sandbox: ${sandbox.cwd}`);
    log.info(
      `In another terminal:\n\n  cd ${JSON.stringify(sandbox.cwd)}\n  ${publishCommand}`,
    );
    log.info(`Registry: ${sandbox.registry.url}`);
    log.info("Every package publish is delayed by 3 seconds at the proxy.");
    if (otpMode !== "disabled") {
      const requirement =
        otpMode === "once"
          ? "required once per pnpr session"
          : "required for every package";
      log.info(`Accepted publish OTP: ${MANUAL_OTP_CODE} (${requirement})`);
    }
    await waitForTermination();
  } finally {
    await sandbox[Symbol.asyncDispose]();
  }
  outro(`pnpr stopped. Sandbox preserved at ${sandbox.cwd}`);
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
