import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishPackages } from "../publishPackages.ts";

vi.mock("tinyexec");

const mockedExec = vi.mocked(exec);
const originalStdinIsTTY = Object.getOwnPropertyDescriptor(
  process.stdin,
  "isTTY",
);

function execResult(stdout: string, exitCode = 0) {
  return {
    command: "",
    args: [],
    stdout,
    stderr: "",
    exitCode,
    failed: exitCode !== 0,
    signal: undefined,
    killed: false,
  };
}

function mockExecImplementation(
  fn: (
    cmd: string,
    args: readonly string[],
  ) => Promise<ReturnType<typeof execResult>>,
) {
  mockedExec.mockImplementation(((cmd: string, args?: readonly string[]) =>
    Promise.resolve(fn(cmd, args ?? []))) as any);
}

function setIsTTY(value: boolean) {
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    configurable: true,
  });
}

describe("publishPackages", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.NPM_CONFIG_OTP;
    delete process.env.PNPM_CONFIG_OTP;
    if (originalStdinIsTTY) {
      Object.defineProperty(process.stdin, "isTTY", originalStdinIsTTY);
    }
  });

  it("publishes without otp in non-tty mode", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    setIsTTY(false);
    mockExecImplementation(async () => execResult(""));

    const packages = await getPackages(cwd);
    const pkg = packages.packages.find(
      (pkg) => pkg.packageJson.name === "pkg-a",
    )!;

    await publishPackages({
      releases: [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "public",
          tag: "latest",
        },
      ],
      packages,
    });

    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      expect.not.arrayContaining(["--otp"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          cwd: pkg.dir,
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });

  it("reads initial otp from env and strips it from forwarded env", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    process.env.NPM_CONFIG_OTP = "123456";
    setIsTTY(false);
    mockExecImplementation(async () => execResult(""));

    const packages = await getPackages(cwd);

    await publishPackages({
      releases: [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "public",
          tag: "latest",
        },
      ],
      packages,
    });

    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      expect.arrayContaining(["publish", "--otp", "123456"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });

  it("reads initial otp from PNPM_CONFIG_OTP for pnpm", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "package-lock.json": "",
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    process.env.PNPM_CONFIG_OTP = "654321";
    setIsTTY(false);
    mockExecImplementation(async () => execResult(""));

    const packages = await getPackages(cwd);

    await publishPackages({
      releases: [
        {
          kind: "publish",
          name: "pkg-a",
          version: "1.0.0",
          access: "public",
          tag: "latest",
        },
      ],
      packages: {
        ...packages,
        tool: { ...packages.tool, type: "pnpm" },
      },
    });

    expect(mockedExec).toHaveBeenCalledWith(
      "pnpm",
      expect.arrayContaining(["publish", "--otp", "654321"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          env: expect.objectContaining({
            PNPM_CONFIG_OTP: undefined,
          }),
        }),
      }),
    );
  });
});
