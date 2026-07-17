import { getLastJsonObjectFromString } from "./getLastJsonObjectFromString.ts";

export type FormattedPackageManagerError = {
  code: string;
  message: string;
};

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

export function formatNpmPnpmJsonError(
  error: unknown,
): FormattedPackageManagerError | undefined {
  if (!isJsonObject(error)) {
    return;
  }

  const message =
    typeof error.message === "string"
      ? error.message
      : typeof error.summary === "string"
        ? error.summary
        : "Unknown error";

  return {
    code: typeof error.code === "string" ? error.code : "EUNKNOWN",
    // .detail is npm-specific but for simplicity we handle it at all times
    message: `${message}${typeof error.detail === "string" && error.detail ? `\n${error.detail}` : ""}`,
  };
}

export function getNpmPnpmError({
  stderr,
  stdout,
}: {
  stderr: string;
  stdout: string;
}): FormattedPackageManagerError {
  // NPM's --json output can be included alongside lifecycle scripts' output,
  // so parse the final JSON object. npm 7 printed it to stderr, while npm 9
  // switched back to stdout.
  const json =
    getLastJsonObjectFromString(stderr) || getLastJsonObjectFromString(stdout);
  if (json?.error) {
    const jsonError = formatNpmPnpmJsonError(json.error);
    if (jsonError) {
      return jsonError;
    }
  }

  return {
    code: "EUNKNOWN",
    message: stderr || stdout || "Unknown error",
  };
}
