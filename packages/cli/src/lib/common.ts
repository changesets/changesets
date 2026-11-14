import { createPromiseQueue } from "../utils/createPromiseQueue.ts";
import type {
  PublishResult,
  PublishResultFailed,
  PublishResultSuccess,
  InfoOptions,
  PackageInfoResult,
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

// Pending stages are invisible to the publish-plan preflight, including with OIDC.
export function isStageConflictError(message: string) {
  return message.includes("Cannot stage previously published version");
}

export const isPublishSuccessful = (
  result: PublishResult,
): result is PublishResultSuccess => result.result === "success";

export const isPublishFailure = (
  result: PublishResult,
): result is PublishResultFailed => result.result.startsWith("failed");

// The stage E409 wording is shared by published versions and pending stages.
// Only a fresh lookup against the publishing registry can distinguish them.
export async function resolveStageConflict(
  result: PublishResult,
  options: InfoOptions,
  lookup: (options: InfoOptions) => Promise<PackageInfoResult>,
): Promise<PublishResult> {
  let response: PackageInfoResult;
  try {
    response = await lookup(options);
  } catch (error) {
    response = {
      error: {
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
  if ("error" in response) {
    return {
      name: result.name,
      version: result.version,
      result: "failed",
      code: response.error.code,
      message:
        response.error.message ||
        "Unable to check whether the conflicting version is published.",
    };
  }
  if (response.published && response.info.versions.includes(result.version)) {
    return {
      name: result.name,
      version: result.version,
      result: "failed",
      message: `Cannot stage already published version ${result.name}@${result.version}.`,
    };
  }
  return result;
}
