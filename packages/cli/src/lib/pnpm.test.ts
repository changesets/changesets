import type { Package } from "@changesets/types";
import { exec } from "tinyexec";
import { describe, expect, it, vi } from "vitest";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as pnpm from "./pnpm.ts";
import {
  alreadyPublishedErrorSnapshot,
  need2faErrorSnapshot,
} from "./testing/error-snapshots.ts";
import type {
  PublishResultFailed,
  PublishResultFailedNeeds2fa,
} from "./types.ts";

vi.mock("tinyexec");
const mockedExec = vi.mocked(exec);

describe("package info", () => {
  it("does not use the publish-time registry override for info requests", async () => {
    const info = {
      "dist-tags": { latest: "0.0.1" },
      versions: ["0.0.1"],
    };
    const pkg = {
      dir: "/workspace/packages/package",
      packageJson: {
        name: "@test/package",
        version: "0.0.1",
        publishConfig: {
          registry: "https://publish.example.test",
        },
      },
    } satisfies Package;
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(info),
      stderr: "",
    });

    await expect(pnpm.info({ cwd: "/workspace", pkg })).resolves.toEqual({
      published: true,
      info,
    });
    expect(mockedExec).toHaveBeenCalledWith(
      "pnpm",
      ["info", "@test/package", "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd: "/workspace" },
      },
    );
  });

  it("falls back to plain-text dist-tags when latest is missing", async () => {
    const pkg = {
      dir: "/workspace/packages/package",
      packageJson: {
        name: "@test/package",
        version: "0.0.2-beta.0",
      },
    } satisfies Package;
    const notFound = {
      exitCode: 1,
      stdout: JSON.stringify({
        error: { code: "ERR_PNPM_PACKAGE_NOT_FOUND" },
      }),
      stderr: "",
    };
    mockedExec
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "beta: 0.0.1-beta.0\n",
        stderr: "",
      });

    await expect(pnpm.info({ cwd: "/workspace", pkg })).resolves.toEqual({
      published: true,
      info: {
        "dist-tags": { beta: "0.0.1-beta.0" },
        versions: ["0.0.1-beta.0"],
      },
    });
  });
});

describe("packing", () => {
  it("lets pnpm resolve `publishConfig.directory` from the package manifest", async () => {
    const pkg = {
      dir: "/workspace/packages/package",
      packageJson: {
        name: "@test/package",
        version: "0.0.1",
        publishConfig: { directory: "dist" },
      },
    } satisfies Package;
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await expect(
      pnpm.pack({
        pkg,
        packDir: "/workspace/packages/package/dist",
        outputDir: "/workspace/.packed",
        tarballPath: "/workspace/.packed/package.tgz",
      }),
    ).resolves.toEqual({
      tarballPath: "/workspace/.packed/package.tgz",
    });
    expect(mockedExec).toHaveBeenCalledWith(
      "pnpm",
      ["pack", "--out", "/workspace/.packed/package.tgz", "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd: pkg.dir },
      },
    );
  });
});

describe("publishing", () => {
  const pkg = {
    dir: process.cwd(),
    packageJson: {
      name: "@test/package",
      version: "0.0.1",
    },
  } satisfies Package;

  const release = {
    kind: "publish",
    access: "public",
    name: "@test/package",
    version: "0.0.1",
    tag: "latest",
    tarball: undefined,
  } satisfies PublishReleaseEntry as PublishReleaseEntry;

  it("should return `published` if npm cli succeeds", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const result = await pnpm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("published");
  });

  it("stages a publish and returns its stage id", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        "@test/package": { stageId: "stage-1" },
      }),
      stderr: "",
    });

    await expect(
      pnpm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: "123456",
        stage: true,
      }),
    ).resolves.toEqual({
      name: "@test/package",
      version: "0.0.1",
      result: "staged",
      stageId: "stage-1",
    });
    expect(mockedExec.mock.calls[0][1]).toEqual([
      "stage",
      "publish",
      "--json",
      "--access",
      "public",
      "--tag",
      "latest",
      "--no-git-checks",
      "--otp",
      "123456",
    ]);
  });

  const alreadyPublishedCases = Object.entries(
    alreadyPublishedErrorSnapshot.pnpm,
  );

  it.each(alreadyPublishedCases)(
    "should return correct error if version is already published (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await pnpm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
      });

      expect(result.result).toEqual("failed:already-published");
    },
  );

  const need2faCases = Object.entries(need2faErrorSnapshot.pnpm);

  it.each(need2faCases)(
    "should return correct error if action requires 2fa (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await pnpm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
      });

      expect(result.result).toEqual("failed:needs-2fa");
      expect((result as PublishResultFailedNeeds2fa).message).toEqual(
        expect.stringMatching(
          /(requires additional authentication)|(requires a one-time password)/,
        ),
      );
    },
  );

  // v11.10+ only
  it("returns 2fa state details if provided", async () => {
    mockedExec.mockResolvedValue(need2faErrorSnapshot.pnpm.v11);

    const result = await pnpm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("failed:needs-2fa");
    const error = result as PublishResultFailedNeeds2fa;
    expect(error.code).toEqual("ERR_PNPM_OTP_NON_INTERACTIVE");
    expect(error.authUrl).toMatchInlineSnapshot(
      `"https://www.npmjs.com/auth/cli/[uuid]"`,
    );
    expect(error.doneUrl).toMatchInlineSnapshot(
      `"https://registry.npmjs.org/-/v1/done?authId=[uuid]"`,
    );
  });

  it("preserves pnpm error codes", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: JSON.stringify({
        error: {
          code: "E404",
          message: "failed",
        },
      }),
      stderr: "",
    });

    const result = await pnpm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect((result as PublishResultFailed).code).toBe("E404");
  });

  it("lets pnpm publish `publishConfig.directory` natively", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await pnpm.publish({
      pkg: {
        ...pkg,
        packageJson: {
          ...pkg.packageJson,
          publishConfig: { directory: "dist" },
        },
      },
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(mockedExec).toHaveBeenCalledWith(
      "pnpm",
      [
        "publish",
        "--json",
        "--access",
        "public",
        "--tag",
        "latest",
        "--no-git-checks",
      ],
      {
        nodePath: false,
        nodeOptions: expect.objectContaining({
          cwd: pkg.dir,
          env: expect.objectContaining({
            PNPM_CONFIG_OTP: undefined,
            pnpm_config_otp: undefined,
            NPM_CONFIG_OTP: undefined,
            npm_config_otp: undefined,
          }),
        }),
      },
    );
  });
});
