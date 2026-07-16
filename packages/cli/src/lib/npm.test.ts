import os from "node:os";
import path from "node:path";
import { stubIsTTY } from "@changesets/test-utils";
import type { Package } from "@changesets/types";
import { exec } from "tinyexec";
import { describe, expect, it, vi } from "vitest";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as npm from "./npm.ts";
import {
  alreadyPublishedErrorSnapshot,
  need2faErrorSnapshot,
} from "./testing/error-snapshots.ts";
import type { PublishResultFailedNeeds2fa } from "./types.ts";

vi.mock("tinyexec");
const mockedExec = vi.mocked(exec);

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

  it("should return `published` if npm cli succeeds", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const result = await npm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("published");
  });

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

      expect(result.result).toEqual("failed:already-published");
    },
  );

  it("returns 2fa state details if provided by npm & process is interactive", async () => {
    mockedExec.mockResolvedValue(need2faErrorSnapshot.npm.v11);
    using _isTTY = stubIsTTY(true);

    const result = await npm.publish({
      pkg,
      release,
      tarballPath: null,
      interactive: false,
      otpCode: null,
    });

    expect(result.result).toEqual("failed:needs-2fa");
    const error = result as PublishResultFailedNeeds2fa;
    expect(error.authUrl).toMatchInlineSnapshot(
      `"https://www.npmjs.com/auth/cli/[uuid]"`,
    );
    expect(error.doneUrl).toMatchInlineSnapshot(
      `"https://registry.npmjs.org/-/v1/done?authId=[uuid]"`,
    );
  });

  it("respects `publishConfig.directory`", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const publishDir = path.join(
      os.tmpdir(),
      `changesets-pubConfDir-${crypto.randomUUID()}`,
    );
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

    expect(result.result).toEqual("published");
    // should call npm publish with the publish directory as an argument
    expect(mockedExec.mock.calls[0][1]?.[1]).toEqual(publishDir);
  });
});
