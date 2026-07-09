import type { Package } from "@changesets/types";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";

export type PublishTool = {
  name: "npm" | "pnpm" | "mock";
  getOtpCode: (otp?: string) => string | null;
  publish: (options: PublishOptions) => Promise<PublishResult>;
};

export type PublishOptions = {
  pkg: Package;
  release: PublishReleaseEntry;
  /** The tarball path passed into the publish command */
  tarballPath: string | null;
  interactive: boolean;
  otpCode: string | null;
};

type PublishResultBase = {
  name: string;
  version: string;
  result: string;
};

export type PublishResultSuccess = PublishResultBase & {
  result: "published" | "published:interactive";
};

export type PublishResultFailed = PublishResultBase & {
  result: "failed";
  summary: string;
};

export type PublishResultAlreadyPublished = PublishResultBase & {
  result: "failed:already-published";
};

export type PublishResultFailedNeeds2fa = PublishResultBase & {
  result: "failed:needs-2fa";
  summary: string;
  authUrl?: string;
  doneUrl?: string;
};

export type PublishResult =
  | PublishResultSuccess
  | PublishResultFailed
  | PublishResultAlreadyPublished
  | PublishResultFailedNeeds2fa;
