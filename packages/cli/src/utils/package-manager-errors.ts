import { stripVTControlCharacters } from "node:util";
import type { PublishTool } from "../lib/types.ts";
import { getLastJsonObjectFromString } from "./getLastJsonObjectFromString.ts";
import { streamNdjson } from "./streamNdjson.ts";

export type FormattedPackageManagerError = {
  code: string;
  message: string;
};

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

type YarnBerryReporterEvent = {
  type: "error";
  name: number;
  displayName?: string;
  data: string;
};

function isYarnBerryReporterEvent(
  event: unknown,
): event is YarnBerryReporterEvent {
  if (!isJsonObject(event) || event.type !== "error") {
    return false;
  }

  return typeof event.name === "number" && typeof event.data === "string";
}

export function getYarnBerryReporterError(
  output: string,
): FormattedPackageManagerError | undefined {
  const errors: FormattedPackageManagerError[] = [];
  let code: string | undefined;

  for (const event of streamNdjson(output)) {
    if (!isYarnBerryReporterEvent(event)) {
      continue;
    }

    const error = {
      code:
        typeof event.displayName === "string" && event.displayName
          ? event.displayName
          : `YN${String(event.name).padStart(4, "0")}`,
      message: stripVTControlCharacters(event.data),
    };
    // this is YN0000 "summary" printed at the end, just skip it at all times
    if (error.message.startsWith("Failed with errors")) {
      continue;
    }
    if (errors.length > 0 && error.code !== code) {
      break;
    }

    code = error.code;
    errors.push(error);
  }

  if (!errors.length) {
    return;
  }

  return {
    code: errors[0].code,
    message: errors.map((error) => error.message).join("\n"),
  };
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

export function getPackageManagerError(
  publishTool: PublishTool,
  { stderr, stdout }: { stderr: string; stdout: string },
): FormattedPackageManagerError {
  if (publishTool.name === "yarn") {
    const reporterError = getYarnBerryReporterError(stdout);
    if (reporterError) {
      return reporterError;
    }
  } else {
    // NPM's --json output can be included alongside lifecycle scripts' output, like `prepublish` and `postpublish`, in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // - npm9 switched back to printing `--json` errors to stdout (https://github.com/npm/cli/commit/d3543e945e721783dcb83385935f282a4bb32cf3)
    // Note that the `--json` output is always printed at the end so this should work
    const json =
      getLastJsonObjectFromString(stderr) ||
      getLastJsonObjectFromString(stdout);
    if (json?.error) {
      const jsonError = formatNpmPnpmJsonError(json.error);
      if (jsonError) {
        return jsonError;
      }
    }
  }

  return {
    code: "EUNKNOWN",
    message: stderr || stdout || "Unknown error",
  };
}
