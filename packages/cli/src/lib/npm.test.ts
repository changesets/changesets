import path from "node:path";
import type { Package } from "@changesets/types";
import { exec } from "tinyexec";
import { describe, expect, it, vi } from "vitest";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as npm from "./npm.ts";
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
  it("passes scoped and fallback publish registries in precedence order", async () => {
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
          "@test:registry": "https://scoped.example.test",
          registry: "https://fallback.example.test",
        },
      },
    } satisfies Package;
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify(info),
      stderr: "",
    });

    await expect(npm.info({ cwd: "/workspace", pkg })).resolves.toEqual({
      published: true,
      info,
    });
    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      [
        "info",
        "@test/package",
        "--@test:registry=https://scoped.example.test",
        "--registry=https://fallback.example.test",
        "--json",
      ],
      {
        nodePath: false,
        nodeOptions: { cwd: "/workspace" },
      },
    );
  });
});

describe("publishing", () => {
  const release = {
    kind: "publish",
    access: "public",
    name: "@test/package",
    version: "0.0.1",
    tag: "latest",
    tarball: undefined,
  } satisfies PublishReleaseEntry as PublishReleaseEntry;

  const pkg = {
    dir: process.cwd(),
    packageJson: {
      name: "@test/package",
      version: "0.0.1",
    },
  } satisfies Package;

  it("should return `success` if the package manager succeeds", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const result = await npm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("success");
  });

  it("accepts a successful stage command without a stage ID", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "{}", stderr: "" });
    await expect(
      npm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
        stage: true,
      }),
    ).resolves.toMatchObject({
      result: "success",
      stageId: undefined,
    });
  });

  it("stages a publish and returns its stage id", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ stageId: "stage-1" }),
      stderr: "",
    });

    await expect(
      npm.publish({
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
      result: "success",
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
      "--otp",
      "123456",
    ]);
  });

  it.each([false, true])(
    "only skips a duplicate stage in staging mode (%s)",
    async (stage) => {
      mockedExec.mockResolvedValueOnce({
        exitCode: 1,
        stderr: "",
        stdout: JSON.stringify({
          error: {
            code: "E409",
            summary:
              '409 Conflict - POST https://registry.npmjs.org/-/stage/package/@test%2fpackage - Cannot stage previously published version "0.0.1".',
            detail: "",
          },
        }),
      });
      if (stage)
        mockedExec.mockResolvedValueOnce({
          exitCode: 1,
          stdout: JSON.stringify({
            error: { code: "E404", summary: "Not found" },
          }),
          stderr: "",
        });
      const result = await npm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
        stage,
      });
      expect(result.result).toBe(stage ? "failed:already-done" : "failed");
      expect(result).not.toHaveProperty("stageId");
    },
  );

  const alreadyPublishedCases = Object.entries(
    alreadyPublishedErrorSnapshot.npm,
  );

  it.each(alreadyPublishedCases)(
    "should handle error if version is already published (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await npm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
      });

      expect(result.result).toEqual("failed:already-done");
    },
  );

  it.each(alreadyPublishedCases)(
    "does not ignore duplicate-publish errors while staging (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);
      await expect(
        npm.publish({
          pkg,
          release,
          tarballPath: null,
          interactive: false,
          otpCode: null,
          stage: true,
        }),
      ).resolves.toHaveProperty("result", "failed");
      expect(mockedExec).toHaveBeenCalledOnce();
    },
  );

  const need2faCases = Object.entries(need2faErrorSnapshot.npm);

  it.each(need2faCases)(
    "should handle error if action requires 2fa (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await npm.publish({
        pkg,
        release,
        tarballPath: null,
        interactive: false,
        otpCode: null,
      });

      expect(result.result).toEqual("failed:needs-2fa");
      expect((result as PublishResultFailedNeeds2fa).message).toContain(
        "one-time password",
      );
    },
  );

  it("returns 2fa state details if provided by npm", async () => {
    mockedExec.mockResolvedValue(need2faErrorSnapshot.npm.v11);

    const result = await npm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("failed:needs-2fa");
    const error = result as PublishResultFailedNeeds2fa;
    expect(error.code).toEqual("EOTP");
    expect(error.authUrl).toMatchInlineSnapshot(
      `"https://www.npmjs.com/auth/cli/[uuid]"`,
    );
    expect(error.doneUrl).toMatchInlineSnapshot(
      `"https://registry.npmjs.org/-/v1/done?authId=[uuid]"`,
    );
  });

  it("preserves npm error codes", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 1,
      stdout: JSON.stringify({
        error: {
          code: "ECUSTOM",
          summary: "failed",
          detail: "",
        },
      }),
      stderr: "",
    });

    const result = await npm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect((result as PublishResultFailed).code).toBe("ECUSTOM");
  });

  it("respects `publishConfig.directory`", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const publishDir = "dist";
    const pkgWithPublishConfigDirectory = {
      ...pkg,
      packageJson: {
        ...pkg.packageJson,
        publishConfig: {
          directory: publishDir,
        },
      },
    } satisfies Package;

    const result = await npm.publish({
      pkg: pkgWithPublishConfigDirectory,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("success");
    expect(mockedExec).toHaveBeenCalledWith(
      "npm",
      [
        "publish",
        path.resolve(pkg.dir, publishDir),
        "--json",
        "--access",
        "public",
        "--tag",
        "latest",
      ],
      {
        nodePath: false,
        nodeOptions: expect.objectContaining({
          cwd: pkg.dir,
          env: expect.objectContaining({
            NPM_CONFIG_OTP: undefined,
            npm_config_otp: undefined,
          }),
        }),
      },
    );
  });

  it("publishes a tarball instead of `publishConfig.directory` when both are provided", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    const tarballPath = path.join(pkg.dir, ".packed", "package.tgz");

    await npm.publish({
      pkg: {
        ...pkg,
        packageJson: {
          ...pkg.packageJson,
          publishConfig: { directory: "dist" },
        },
      },
      release,
      tarballPath,
      interactive: false,
      otpCode: null,
    });

    expect(mockedExec.mock.calls[0][1]).toEqual([
      "publish",
      path.relative(pkg.dir, tarballPath),
      "--json",
      "--access",
      "public",
      "--tag",
      "latest",
    ]);
  });
});

describe("fresh published-version lookup", () => {
  const pkg = {
    dir: process.cwd(),
    packageJson: { name: "@test/package", version: "0.0.1" },
  } satisfies Package;
  it("queries the exact version against the publishing registry", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({ versions: ["0.0.1"], "dist-tags": {} }),
    });
    await expect(
      npm.publishedVersion({
        cwd: pkg.dir,
        pkg: {
          ...pkg,
          packageJson: {
            ...pkg.packageJson,
            publishConfig: { registry: "https://publish.example.test" },
          },
        },
      }),
    ).resolves.toMatchObject({ published: true });
    expect(mockedExec.mock.lastCall?.[1]).toEqual(
      expect.arrayContaining([
        "info",
        "@test/package@0.0.1",
        "--registry=https://publish.example.test",
        "--@test:registry=https://publish.example.test",
        "--prefer-online",
        "--offline=false",
      ]),
    );
  });

  it("rejects malformed published versions", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({ versions: "0.0.1" }),
    });
    await expect(
      npm.publishedVersion({ cwd: pkg.dir, pkg }),
    ).resolves.toHaveProperty("error");
  });
});
