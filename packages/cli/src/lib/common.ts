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

export const isPublishSuccessful = (
  result: PublishResult,
): result is PublishResultSuccess => result.result === "published";

export const isPublishFailure = (
  result: PublishResult,
): result is PublishResultFailed => result.result.startsWith("failed");
