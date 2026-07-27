import type { Package } from "@changesets/types";
import { exec } from "tinyexec";
import { describe, expect, it, vi } from "vitest";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as yarn from "./yarn.ts";

vi.mock("tinyexec");
const mockedExec = vi.mocked(exec);

const pkg = {
  dir: "/workspace/packages/package",
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

describe("reporter errors", () => {
  it("combines the first error code, strips formatting, and ignores summaries", () => {
    const output = [
      JSON.stringify({ type: "info", data: "ignored" }),
      JSON.stringify({
        type: "error",
        name: 35,
        displayName: "YN0035",
        data: "\u001B[31mfirst line\u001B[39m",
      }),
      JSON.stringify({ type: "error", name: 35, data: "second line" }),
      JSON.stringify({
        type: "error",
        name: 0,
        data: "Failed with errors in 1s",
      }),
      JSON.stringify({ type: "error", name: 33, data: "different error" }),
    ].join("\n");

    expect(yarn.getYarnBerryReporterError(output)).toEqual({
      code: "YN0035",
      message: "first line\nsecond line",
    });
  });
});

describe("package info", () => {
  it("uses Yarn's fetch registry and returns the last NDJSON entry", async () => {
    const info = {
      "dist-tags": { latest: "0.0.1" },
      versions: ["0.0.1"],
    };
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: [
        JSON.stringify({ name: "@test/package" }),
        JSON.stringify(info),
      ].join("\n"),
      stderr: "",
    });

    await expect(
      yarn.info({
        cwd: "/workspace",
        pkg: {
          ...pkg,
          packageJson: {
            ...pkg.packageJson,
            publishConfig: {
              registry: "https://publish.example.test",
            },
          },
        },
      }),
    ).resolves.toEqual({ published: true, info });
    expect(mockedExec).toHaveBeenCalledWith(
      "yarn",
      ["npm", "info", "@test/package", "--json"],
      {
        nodePath: false,
        nodeOptions: { cwd: "/workspace" },
      },
    );
  });
});

describe("publishing", () => {
  it("stages a publish and returns its stage id", async () => {
    mockedExec.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ stageId: "stage-1" }),
      stderr: "",
    });

    await expect(
      yarn.publish({
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
      "npm",
      "publish",
      "--access",
      "public",
      "--tag",
      "latest",
      "--json",
      "--otp",
      "123456",
      "--staged",
    ]);
  });

  it("rejects tarballs without invoking Yarn", async () => {
    await expect(
      yarn.publish({
        pkg,
        release,
        tarballPath: "/workspace/.packed/package.tgz",
        interactive: false,
        otpCode: null,
      }),
    ).resolves.toMatchObject({
      result: "failed",
      message: "Yarn does not support publishing from a tarball.",
    });
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("uses fake stdin to prevent Yarn's non-interactive OTP prompt", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await yarn.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: "123456",
    });

    expect(mockedExec).toHaveBeenCalledWith(
      "yarn",
      [
        "npm",
        "publish",
        "--access",
        "public",
        "--tag",
        "latest",
        "--json",
        "--otp",
        "123456",
      ],
      {
        nodePath: false,
        stdin: "not-otp\n",
        nodeOptions: {
          cwd: pkg.dir,
          stdio: "pipe",
        },
      },
    );
  });
});
