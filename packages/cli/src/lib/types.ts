import type { PublishReleaseEntry } from "../commands/publish-plan/getPublishPlan.ts";

export type AuthState = {
  otpToken: string | undefined;
  /** Indicates if interactive authentication (prompt-based) is required */
  requiresInteractive: boolean;
};

export type PublishOptions = {
  /** The publish command argument, the path to the package or tarball */
  target: string | null;
  /** The current working directory for the publish operation */
  cwd: string;
  /** The environment variables for the publish operation */
  env: NodeJS.ProcessEnv;
  release: PublishReleaseEntry;
  authState: AuthState;
};

type PublishSkipReason = "already-published";

export type InternalPublishFailed = {
  result: "failed";
  summary: string;
  allowRetry?: boolean;
};

export type InternalPublishFailed2faNeeded = InternalPublishFailed & {
  reason: "needs-2fa";
  authUrl?: string;
  doneUrl?: string;
};

export type InternalPublishResult =
  | { result: "published" }
  // TODO: remove "skipped", add "already-published" reason to "failed"
  | { result: "skipped"; reason?: PublishSkipReason }
  | InternalPublishFailed
  | InternalPublishFailed2faNeeded;
