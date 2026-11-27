import { createPromiseQueue } from "../utils/createPromiseQueue.ts";
import type {
  PublishResult,
  PublishResultFailed,
  PublishResultSuccess,
} from "./types.ts";

export const NPM_REQUEST_CONCURRENCY_LIMIT = 40;
export const npmRequestQueue = createPromiseQueue(
  NPM_REQUEST_CONCURRENCY_LIMIT,
);

export const NPM_PUBLISH_CONCURRENCY_LIMIT = 10;
export const npmPublishQueue = createPromiseQueue(
  NPM_PUBLISH_CONCURRENCY_LIMIT,
);

/*
 * We check `npm info` before publishing but it can return stale data at times
 * so we need to gracefully handle this situation
 */
export function isAlreadyPublishedError(message: string) {
  return message.includes("cannot publish over the previously published");
}

// Pending stages are invisible to the current preflight. npm's
// GET /-/package/{package-name}/version/{version}/status could detect them, but
// OIDC access appears unsupported and we have no separate read-token support.
// Split publishing could separate those credentials, but direct status queries
// would add npm-specific behavior and duplicate registry resolution delegated to
// each package manager. This wording also covers published versions, so the
// caller uses info to distinguish them.
export function isStageConflictError(message: string) {
  return message.includes("Cannot stage previously published version");
}

export const isPublishSuccessful = (
  result: PublishResult,
): result is PublishResultSuccess => result.result === "success";

export const isPublishFailure = (
  result: PublishResult,
): result is PublishResultFailed => result.result.startsWith("failed");
