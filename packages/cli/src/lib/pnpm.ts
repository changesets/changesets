import path from "node:path";
import { exec } from "tinyexec";
import {
  isAlreadyPublishedError,
  NPM_PUBLISH_CONCURRENCY_LIMIT,
  npmPublishQueue,
} from "./common.ts";
import type { InternalPublishResult, PublishOptions } from "./types.ts";

export type PnpmPublishError = {
  error: {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    code: "E403" | "E404" | "ERR_PNPM_OTP_NON_INTERACTIVE" | string;
    message: string;
  };
};

function isPnpmPublishError(error: unknown): error is PnpmPublishError {
  return (
    error != null &&
    typeof error === "object" &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error != null &&
    "code" in error.error &&
    "message" in error.error
  );
}

// -- publish -- //

export async function publish(
  { cwd, target, env, release, authState }: PublishOptions,
  // release: PublishReleaseEntry,
  // authState: AuthState,
): Promise<InternalPublishResult> {
  const args: string[] = [
    "--json",
    "--access",
    release.access,
    "--tag",
    release.tag,
    "--no-git-checks",
  ];
  if (authState.otpToken) {
    args.push("--otp", authState.otpToken);
  }
  if (target) {
    args.unshift(path.relative(cwd, target));
  }

  const { exitCode, stdout, stderr } = await exec("npm", ["publish", ...args], {
    nodeOptions: { env, cwd },
  });
  if (exitCode === 0) {
    // bump the limit up in case we have started with the limit of 1 in the TTY mode
    npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
    return { result: "published" };
  }

  /* -- error handling -- */

  // TODO: handle non-error string
  const json = JSON.parse(stdout.toString().trim());
  // if we get back an unknown error
  if (!isPnpmPublishError(json)) {
    return { result: "failed", summary: stderr || stdout, allowRetry: false };
  }

  if (isAlreadyPublishedError(json.error.message)) {
    // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
    return { result: "skipped", reason: "already-published" };
  }

  const summary = json.error.message.trim();

  if (json.error.code === "ERR_PNPM_OTP_NON_INTERACTIVE") {
    // any otp code must be invalid since it errored
    authState.otpToken = undefined;
    authState.requiresInteractive = true;
    npmPublishQueue.setConcurrency(1);

    return {
      result: "failed",
      summary,
      // TODO: update/remove this comment after reworking publish function flow
      // given we have just adjusted the concurrency, we need to handle the retries in the layer that requeues the publish
      // calling internalPublish again would allow concurrent failures to run again concurrently
      // but only one retried publish should get delegated to the npm cli and other ones should "await" its successful result before being retried
      allowRetry: true,
    } satisfies InternalPublishResult;
  }

  return { result: "failed", summary };
}
