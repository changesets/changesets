import type { Package } from "@changesets/types";
import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";

export type PublishTool = {
  name: "npm" | "pnpm" | "yarn";
  getOtpCode: (otp?: string) => string | null;
  info: (options: InfoOptions) => Promise<PackageInfoResult>;
  pack: (options: PackOptions) => Promise<PackResult>;
  publish: (options: PublishOptions) => Promise<PublishResult>;
};

export type InfoOptions = {
  cwd: string;
  pkg: Package;
};

export type PackageInfo = Record<string, unknown> & {
  "dist-tags": Record<string, string>;
  versions: string[];
};

export type PackageInfoResult =
  | {
      published: true;
      info: PackageInfo;
    }
  | {
      published: false;
    }
  | {
      error: {
        code?: string;
        message?: string;
      };
    };

export type PackOptions = {
  pkg: Package;
  packDir: string;
  outputDir: string;
  tarballPath: string;
};

export type PackResult =
  | {
      tarballPath: string;
    }
  | {
      error: {
        code?: string;
        message?: string;
      };
    };

export type PublishOptions = {
  pkg: Package;
  release: PublishReleaseEntry;
  /** The tarball path passed into the publish command */
  tarballPath: string | null;
  interactive: boolean;
  otpCode: string | null;
  stage?: boolean;
};

type PublishResultBase = {
  name: string;
  version: string;
  result: string;
};

export type PublishResultSuccess = PublishResultBase & {
  result: "published";
};

export type PublishResultStaged = PublishResultBase & {
  result: "staged";
  stageId: string;
};

export type PublishResultFailed = PublishResultBase & {
  result: "failed";
  code?: string;
  message?: string;
};

export type PublishResultAlreadyPublished = PublishResultBase & {
  result: "failed:already-published";
  code?: string;
};

export type PublishResultFailedNeeds2fa = PublishResultBase & {
  result: "failed:needs-2fa";
  code?: string;
  message?: string;
  authUrl?: string;
  doneUrl?: string;
};

export type PublishResult =
  | PublishResultSuccess
  | PublishResultStaged
  | PublishResultFailed
  | PublishResultAlreadyPublished
  | PublishResultFailedNeeds2fa;
