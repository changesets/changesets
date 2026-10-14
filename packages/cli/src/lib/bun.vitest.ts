import { PassThrough } from "node:stream";
import type { Package } from "@changesets/types";
import type { exec, Output } from "tinyexec";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as bun from "./bun.ts";
import type { PublishOptions } from "./types.ts";

declare const vi: typeof import("vitest").vi;
declare const it: typeof import("vitest").it;
declare const describe: typeof import("vitest").describe;
declare const expect: typeof import("vitest").expect;
declare const beforeEach: typeof import("vitest").beforeEach;
declare const afterEach: typeof import("vitest").afterEach;

const { mockedExec } = vi.hoisted(() => ({ mockedExec: vi.fn<typeof exec>() }));
vi.mock("tinyexec", () => ({ exec: mockedExec }));

const pkg = {
  dir: "/workspace/packages/pkg-a",
  packageJson: { name: "pkg-a", version: "1.0.0" },
} satisfies Package;
const release = {
  kind: "publish",
  name: "pkg-a",
  version: "1.0.0",
  access: "public",
  tag: "next",
} satisfies PublishReleaseEntry;
const publishOptions = {
  pkg,
  release,
  tarballPath: null,
  interactive: false,
  otpCode: null,
} satisfies PublishOptions;

beforeEach(() => {
  mockedExec.mockReset();
  vi.stubEnv("NPM_CONFIG_OTP", undefined);
  vi.stubEnv("npm_config_otp", undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("publishing", () => {
  it("recognizes an OTP prompt on stdout even when stderr reports EOF", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "This operation requires a one-time password.\nEnter OTP: ",
      stderr: "EndOfStream: failed to read OTP input\n",
    });

    await expect(bun.publish(publishOptions)).resolves.toEqual({
      name: "pkg-a",
      version: "1.0.0",
      result: "failed:needs-2fa",
      code: undefined,
      message:
        "EndOfStream: failed to read OTP input\nThis operation requires a one-time password.\nEnter OTP:",
    });
  });

  it("uses legacy auth and closed stdin for captured publishing, and clears inherited OTPs", async () => {
    vi.stubEnv("NPM_CONFIG_OTP", "rejected-code");
    vi.stubEnv("npm_config_otp", "another-rejected-code");
    vi.stubEnv("NPM_CONFIG_TOKEN", "test-token");
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await expect(
      bun.publish({ ...publishOptions, otpCode: "123456" }),
    ).resolves.toMatchObject({ result: "published" });
    expect(mockedExec).toHaveBeenCalledWith(
      "bun",
      [
        "publish",
        "--access",
        "public",
        "--tag",
        "next",
        "--auth-type",
        "legacy",
        "--otp",
        "123456",
      ],
      {
        nodePath: false,
        stdin: "",
        nodeOptions: {
          cwd: pkg.dir,
          stdio: "pipe",
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
            npm_config_otp: undefined,
            NPM_CONFIG_TOKEN: "test-token",
          }),
        },
      },
    );
  });

  it("lets an interactive retry use Bun's default web auth without the rejected OTP", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await bun.publish({ ...publishOptions, interactive: true });

    expect(mockedExec).toHaveBeenCalledWith(
      "bun",
      ["publish", "--access", "public", "--tag", "next"],
      {
        nodePath: false,
        nodeOptions: {
          cwd: pkg.dir,
          stdio: "inherit",
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
            npm_config_otp: undefined,
          }),
        },
      },
    );
  });

  it.each(["stdout", "stderr"] as const)(
    "stops a captured web-auth prompt split across %s chunks and requests an interactive retry",
    async (streamName) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const { promise, resolve } = Promise.withResolvers<Output>();
      const kill = vi.fn(() => {
        resolve({ exitCode: 1, stdout: "", stderr: "" });
        return true;
      });
      mockedExec.mockReturnValue(
        Object.assign(promise, {
          process: { stdout, stderr },
          kill,
        }) as unknown as ReturnType<typeof exec>,
      );
      const pending = bun.publish(publishOptions);
      const stream = streamName === "stdout" ? stdout : stderr;
      stream.write("\nAuthenticate your ");
      expect(kill).not.toHaveBeenCalled();
      stream.write("account at (press ENTER to open in browser):\n");
      stream.write(
        "\nAuthenticate your account at (press ENTER to open in browser):\n",
      );

      await expect(pending).resolves.toMatchObject({
        result: "failed:needs-2fa",
      });
      expect(kill).toHaveBeenCalledTimes(1);
      expect(stdout.listenerCount("data")).toBe(0);
      expect(stderr.listenerCount("data")).toBe(0);
      stdout.destroy();
      stderr.destroy();
    },
  );

  it.each([
    {
      output:
        "403 Forbidden: registry\n - You cannot publish over the previously published versions: 1.0.0.",
      expected: "failed:already-published",
      code: "E403",
    },
    {
      output: "403 Forbidden: registry\n - Publishing is forbidden by policy.",
      expected: "failed",
      code: "E403",
    },
    {
      output: "401 Unauthorized: registry\n - Invalid authentication token.",
      expected: "failed",
      code: "E401",
    },
    {
      output:
        "409 Conflict: registry\n - You cannot publish over the previously published versions: 1.0.0.",
      expected: "failed:already-published",
      code: "E409",
    },
    {
      output:
        "error: prepublishOnly script failed: cannot publish over the previously published versions",
      expected: "failed",
      code: undefined,
    },
  ])(
    "classifies $expected without treating every registry rejection as OTP",
    async ({ output, expected, code }) => {
      mockedExec.mockResolvedValue({
        exitCode: 1,
        stdout: "bun publish",
        stderr: output,
      });
      await expect(bun.publish(publishOptions)).resolves.toMatchObject({
        result: expected,
        code,
      });
    },
  );

  it("publishes an absolute tarball path for artifact mode", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    await bun.publish({
      ...publishOptions,
      pkg: {
        ...pkg,
        packageJson: {
          ...pkg.packageJson,
          publishConfig: { directory: "missing-dist" },
        },
      },
      tarballPath: "/artifacts/pkg-a-1.0.0.tgz",
    });
    expect(mockedExec).toHaveBeenCalledWith(
      "bun",
      expect.arrayContaining(["publish", "/artifacts/pkg-a-1.0.0.tgz"]),
      expect.objectContaining({
        nodeOptions: expect.objectContaining({ cwd: pkg.dir }),
      }),
    );
  });

  it("rejects publishing a different directory before invoking Bun", async () => {
    await expect(
      bun.publish({
        ...publishOptions,
        pkg: {
          ...pkg,
          packageJson: {
            ...pkg.packageJson,
            publishConfig: { directory: "dist" },
          },
        },
      }),
    ).resolves.toMatchObject({
      result: "failed",
      message: expect.stringContaining("publishConfig.directory"),
    });
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it.each([
    "Enter OTP: ",
    "This operation requires a one-time password.",
    "invalid OTP",
  ])("does not retry lifecycle output containing %s", async (stdout) => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout,
      stderr: "error: prepublishOnly script failed",
    });
    await expect(bun.publish(publishOptions)).resolves.toMatchObject({
      result: "failed",
    });
  });

  it("does not stop lifecycle output mentioning web authentication", async () => {
    const stdout = new PassThrough();
    const { promise, resolve } = Promise.withResolvers<Output>();
    const kill = vi.fn();
    mockedExec.mockReturnValue(
      Object.assign(promise, {
        process: { stdout },
        kill,
      }) as unknown as ReturnType<typeof exec>,
    );
    const pending = bun.publish(publishOptions);
    stdout.write(
      "Authenticate your account at https://registry.example.test/auth\n",
    );
    resolve({
      exitCode: 1,
      stdout: "",
      stderr: "error: prepublishOnly script failed",
    });
    await expect(pending).resolves.toMatchObject({ result: "failed" });
    expect(kill).not.toHaveBeenCalled();
    expect(stdout.listenerCount("data")).toBe(0);
    stdout.destroy();
  });

  it("does not mistake a packed filename containing otp for an auth challenge", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "packed 100B otp.js",
      stderr: "403 Forbidden: registry\n - Publishing is forbidden by policy.",
    });
    await expect(bun.publish(publishOptions)).resolves.toMatchObject({
      result: "failed",
      code: "E403",
    });
  });

  it("recognizes an invalid OTP reported by the registry", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "401 Unauthorized: registry\n - Invalid OTP.",
    });
    await expect(bun.publish(publishOptions)).resolves.toMatchObject({
      result: "failed:needs-2fa",
      code: "E401",
    });
  });
});

describe("OTP precedence", () => {
  it("prefers the CLI value, then uppercase env, then lowercase env", () => {
    vi.stubEnv("NPM_CONFIG_OTP", "uppercase");
    vi.stubEnv("npm_config_otp", "lowercase");
    expect(bun.getOtpCode("explicit")).toBe("explicit");
    expect(bun.getOtpCode()).toBe("uppercase");
    vi.stubEnv("NPM_CONFIG_OTP", undefined);
    expect(bun.getOtpCode()).toBe("lowercase");
    vi.stubEnv("npm_config_otp", undefined);
    expect(bun.getOtpCode()).toBeNull();
  });
});

describe("package info", () => {
  it("combines all versions with a separate dist-tags query", async () => {
    mockedExec.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ versions: ["1.0.0", "2.0.0-beta.1"] }),
      stderr: "",
    });
    mockedExec.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({ latest: "1.0.0", next: "2.0.0-beta.1" }),
      stderr: "",
    });
    await expect(bun.info({ cwd: "/workspace", pkg })).resolves.toEqual({
      published: true,
      info: {
        versions: ["1.0.0", "2.0.0-beta.1"],
        "dist-tags": { latest: "1.0.0", next: "2.0.0-beta.1" },
      },
    });
    expect(mockedExec).toHaveBeenNthCalledWith(
      2,
      "bun",
      ["info", "pkg-a", "dist-tags", "--json", "--no-cache"],
      { nodePath: false, nodeOptions: { cwd: pkg.dir } },
    );
  });

  it("looks up the exact version when the registry has no latest tag", async () => {
    mockedExec.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '{ "error": "No matching version found" }',
      stderr: "",
    });
    mockedExec.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{ "versions": ["1.0.0"] }',
      stderr: "",
    });
    mockedExec.mockResolvedValueOnce({
      exitCode: 0,
      stdout: '{ "next": "1.0.0" }',
      stderr: "",
    });
    await expect(bun.info({ cwd: "/workspace", pkg })).resolves.toMatchObject({
      published: true,
      info: { versions: ["1.0.0"] },
    });
    expect(mockedExec).toHaveBeenNthCalledWith(
      2,
      "bun",
      ["info", "pkg-a@1.0.0", "--json", "--no-cache"],
      expect.anything(),
    );
  });

  it("returns unpublished only when both lookups report not found", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "404 Not Found: registry",
    });
    await expect(bun.info({ cwd: "/workspace", pkg })).resolves.toEqual({
      published: false,
    });
  });

  it("propagates authentication errors without treating them as unpublished", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "401 Unauthorized: registry",
    });
    await expect(bun.info({ cwd: "/workspace", pkg })).resolves.toMatchObject({
      error: { code: "E401" },
    });
    expect(mockedExec).toHaveBeenCalledTimes(1);
  });
});

describe("packing", () => {
  it("rejects packing a different directory before invoking Bun", async () => {
    await expect(
      bun.pack({
        pkg,
        packDir: `${pkg.dir}/dist`,
        outputDir: "/artifacts",
        tarballPath: "/artifacts/pkg-a.tgz",
      }),
    ).resolves.toMatchObject({
      error: { message: expect.stringContaining("publishConfig.directory") },
    });
    expect(mockedExec).not.toHaveBeenCalled();
  });
  it("propagates a missing workspace version instead of reporting a tarball", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: "bun pack",
      stderr:
        'error: Failed to resolve workspace version for "pkg-b". Run `bun install` and try again.',
    });
    await expect(
      bun.pack({
        pkg,
        packDir: pkg.dir,
        outputDir: "/artifacts",
        tarballPath: "/artifacts/pkg-a.tgz",
      }),
    ).resolves.toMatchObject({
      error: { message: expect.stringContaining("bun install") },
    });
  });
});
