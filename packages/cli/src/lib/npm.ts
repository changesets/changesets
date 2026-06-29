import path from "node:path";
import { exec } from "tinyexec";
import {
  isAlreadyPublishedError,
  NPM_PUBLISH_CONCURRENCY_LIMIT,
  npmPublishQueue,
} from "./common.ts";
import type { InternalPublishResult, PublishOptions } from "./types.ts";

export type NpmPublishENeedAuthError = {
  code: "ENEEDAUTH";
  summary: string;
  detail: string;
};

export type NpmPublishEOtpError = {
  code: "EOTP";
  summary: string;
  detail: string;
  authUrl?: string;
  /** returns `""` if not authed yet, `"[token]"` after user has authed */
  doneUrl?: string;
};

export type NpmPublishGenericError = {
  code?: string;
  summary: string;
  detail: string;
};

export type NpmPublishError = {
  error:
    | NpmPublishENeedAuthError
    | NpmPublishEOtpError
    | NpmPublishGenericError;
};

function isNpmPublishError(err: unknown): err is NpmPublishError {
  return (
    err != null &&
    typeof err === "object" &&
    "error" in err &&
    "summary" in (err as NpmPublishError).error
  );
}

// -- publish -- //

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
export async function publish({
  cwd,
  target,
  env,
  release,
  authState,
}: PublishOptions): Promise<InternalPublishResult> {
  const args: string[] = [
    "--json",
    "--access",
    release.access,
    "--tag",
    release.tag,
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
  if (!isNpmPublishError(json)) {
    return { result: "failed", summary: stderr || stdout, allowRetry: false };
  }

  // npm v11 doesn't return a `code` on already-published errors
  if (isAlreadyPublishedError(json.error.summary)) {
    // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
    return { result: "skipped", reason: "already-published" };
  }

  const summary = `
${json.error.summary ?? ""}
${json.error.detail ?? ""}
  `.trim();

  if (json.error.code === "EOTP") {
    if (
      process.stdin.isTTY ||
      process.env.CHANGESETS_TEST_INTERACTIVE != null
    ) {
      // any otp code must be invalid since it errored
      authState.otpToken = undefined;
      authState.requiresInteractive = true;
      npmPublishQueue.setConcurrency(1);

      const result = {
        result: "failed",
        summary,
        // TODO: update/remove this comment after reworking publish function flow
        // given we have just adjusted the concurrency, we need to handle the retries in the layer that requeues the publish
        // calling internalPublish again would allow concurrent failures to run again concurrently
        // but only one retried publish should get delegated to the npm cli and other ones should "await" its successful result before being retried
        allowRetry: true,
      } satisfies InternalPublishResult;

      // npm v11 returns data we can use to handle 2fa in-process
      // TODO: handle "needs-2fa" result
      if ("authUrl" in json.error) {
        (result as any).reason = "needs-2fa";
        (result as any).authUrl = json.error.authUrl;
        (result as any).doneUrl = json.error.doneUrl;
      }

      return result;
    }
  }

  return { result: "failed", summary };
}
