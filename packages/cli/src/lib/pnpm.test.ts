import { exec } from "tinyexec";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";
import * as pnpm from "./pnpm.ts";
import {
  alreadyPublishedErrorSnapshot,
  need2faErrorSnapshot,
} from "./testing/error-snapshots.ts";
import type {
  InternalPublishFailed,
  InternalPublishFailed2faNeeded,
} from "./types.ts";

vi.mock("tinyexec");
const mockedExec = vi.mocked(exec);

beforeEach(() => {
  vi.unstubAllEnvs();
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

  it("should return `published` if npm cli succeeds", async () => {
    mockedExec.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const result = await pnpm.publish({
      target: null,
      release,
      cwd: process.cwd(),
      env: {},
      authState: {
        otpToken: "123456",
        requiresInteractive: false,
      },
    });

    expect(result.result).toEqual("published");
  });

  const alreadyPublishedCases = Object.entries(
    alreadyPublishedErrorSnapshot.pnpm,
  );

  it.each(alreadyPublishedCases)(
    "should handle error if version is already published (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await pnpm.publish({
        target: null,
        release,
        cwd: process.cwd(),
        env: {},
        authState: {
          otpToken: "123456",
          requiresInteractive: false,
        },
      });

      expect(result.result).toEqual("skipped");
      expect((result as any).reason).toEqual("already-published");
    },
  );

  const need2faCases = Object.entries(need2faErrorSnapshot.pnpm);

  it.each(need2faCases)(
    "should handle error if action requires 2fa (%s)",
    async (_, snapshot) => {
      mockedExec.mockResolvedValue(snapshot);

      const result = await pnpm.publish({
        target: null,
        release,
        cwd: process.cwd(),
        env: {},
        authState: {
          otpToken: "123456",
          requiresInteractive: false,
        },
      });

      expect(result.result).toEqual("failed");
      expect((result as InternalPublishFailed).summary).toContain(
        "requires additional authentication",
      );
    },
  );

  // TODO: requires https://github.com/pnpm/pnpm/issues/12724
  // eslint-disable-next-line vitest/no-disabled-tests
  it.skip("returns 2fa state details if provided & process is interactive", async () => {
    mockedExec.mockResolvedValue(need2faErrorSnapshot.pnpm.v11);
    vi.stubEnv("CHANGESETS_TEST_INTERACTIVE", "true");

    const result = await pnpm.publish({
      target: null,
      release,
      cwd: process.cwd(),
      env: {},
      authState: {
        otpToken: "123456",
        requiresInteractive: false,
      },
    });

    expect(result.result).toEqual("failed");

    const error = result as InternalPublishFailed2faNeeded;
    expect(error.reason).toEqual("needs-2fa");
    expect(error.authUrl).toMatchInlineSnapshot(
      `"https://www.npmjs.com/auth/cli/[uuid]"`,
    );
    expect(error.doneUrl).toMatchInlineSnapshot(
      `"https://registry.npmjs.org/-/v1/done?authId=[uuid]"`,
    );
  });
});
