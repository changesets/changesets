import { ExitError } from "@changesets/errors";
import { error, info, warn } from "@changesets/logger";
import { PackageJSON } from "@changesets/types";
import pLimit from "p-limit";
import preferredPM from "preferred-pm";
import chalk from "chalk";
import spawn from "spawndamnit";
import semver from "semver";
import { askQuestion } from "../../utils/cli-utilities";
import isCI from "../../utils/isCI";
import { TwoFactorState } from "../../utils/types";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString";

const npmRequestLimit = pLimit(40);
const npmPublishLimit = pLimit(10);

function jsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("error parsing json:", input);
    }
    throw err;
  }
}

function getCorrectRegistry(packageJson?: PackageJSON): string {
  const registry =
    packageJson?.publishConfig?.registry ?? process.env.npm_config_registry;

  return !registry || registry === "https://registry.yarnpkg.com"
    ? "https://registry.npmjs.org"
    : registry;
}

async function getPublishTool(
  cwd: string
): Promise<{ name: "npm" | "pnpm" | "yarn"; args: string[]; flags: string[] }> {
  const pm = await preferredPM(cwd);
  if (!pm) {
    return { name: "npm", args: ["publish"], flags: [] };
  }
  const version = (await spawn(pm.name, ["--version"], { cwd })).stdout
    .toString()
    .trim();

  const parsed = semver.parse(version)!;

  switch (pm.name) {
    case "npm":
      return { name: "npm", args: ["publish"], flags: [] };
    case "pnpm":
      if (parsed.major < 5) {
        return { name: "pnpm", args: ["publish"], flags: [] };
      }
      return { name: "pnpm", args: ["publish"], flags: ["--no-git-checks"] };
    case "yarn":
      // Yarn Classic doesn't do anything special when publishing, let's stick to the npm client in such a case
      if (parsed.major < 2) {
        return { name: "npm", args: ["publish"], flags: [] };
      }
      return { name: "yarn", args: ["npm", "publish"], flags: [] };
    default:
      return { name: "npm", args: ["publish"], flags: [] };
  }
}

export async function getTokenIsRequired() {
  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    npm_config_registry: getCorrectRegistry()
  };
  let result = await spawn("npm", ["profile", "get", "--json"], {
    env: Object.assign({}, process.env, envOverride)
  });
  let json = jsonParse(result.stdout.toString());
  if (json.error || !json.tfa || !json.tfa.mode) {
    return false;
  }
  return json.tfa.mode === "auth-and-writes";
}

export function getPackageInfo(packageJson: PackageJSON) {
  return npmRequestLimit(async () => {
    info(`npm info ${packageJson.name}`);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    let result = await spawn("npm", [
      "info",
      packageJson.name,
      "--registry",
      getCorrectRegistry(packageJson),
      "--json"
    ]);

    // Github package registry returns empty string when calling npm info
    // for a non-existant package instead of a E404
    if (result.stdout.toString() === "") {
      return {
        error: {
          code: "E404"
        }
      };
    }
    return jsonParse(result.stdout.toString());
  });
}

export async function infoAllow404(packageJson: PackageJSON) {
  let pkgInfo = await getPackageInfo(packageJson);
  if (pkgInfo.error?.code === "E404") {
    warn(`Received 404 for npm info ${chalk.cyan(`"${packageJson.name}"`)}`);
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    error(
      `Received an unknown error code: ${
        pkgInfo.error.code
      } for npm info ${chalk.cyan(`"${packageJson.name}"`)}`
    );
    error(pkgInfo.error.summary);
    if (pkgInfo.error.detail) error(pkgInfo.error.detail);

    throw new ExitError(1);
  }
  return { published: true, pkgInfo };
}

let otpAskLimit = pLimit(1);

let askForOtpCode = (twoFactorState: TwoFactorState) =>
  otpAskLimit(async () => {
    if (twoFactorState.token !== null) return twoFactorState.token;
    info(
      "This operation requires a one-time password from your authenticator."
    );

    let val = await askQuestion("Enter one-time password:");
    twoFactorState.token = val;
    return val;
  });

export let getOtpCode = async (twoFactorState: TwoFactorState) => {
  if (twoFactorState.token !== null) {
    return twoFactorState.token;
  }
  return askForOtpCode(twoFactorState);
};

const isOtpError = (error: any) => {
  // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
  return (
    error.code === "EOTP" ||
    (error.code === "E401" && error.detail.includes("--otp=<code>"))
  );
};

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  pkgName: string,
  opts: { cwd: string; access?: string; tag: string },
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  let publishTool = await getPublishTool(opts.cwd);
  let shouldHandleOtp =
    !isCI &&
    // yarn berry doesn't accept `--otp` and it asks for it on its own
    publishTool.name !== "yarn";
  let publishFlags = publishTool.name !== "yarn" ? ["--json"] : [];

  if (opts.access) {
    publishFlags.push("--access", opts.access);
  }
  publishFlags.push("--tag", opts.tag);

  if (shouldHandleOtp && (await twoFactorState.isRequired)) {
    let otpCode = await getOtpCode(twoFactorState);
    publishFlags.push("--otp", otpCode);
  }

  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    npm_config_registry: getCorrectRegistry()
  };

  const args = [...publishTool.args, ...publishFlags, ...publishTool.flags];

  info(`will publish with '${publishTool.name} ${args.join(" ")}'`);

  let { code, stdout, stderr } = await spawn(
    publishTool.name,
    args,
    {
      cwd: opts.cwd,
      env: Object.assign({}, process.env, envOverride)
    }
  );

  if (code !== 0) {
    // yarn berry doesn't support --json and we don't attempt to parse its output to a machine-readable format
    if (publishTool.name === "yarn") {
      const output = stdout
        .toString()
        .trim()
        .split("\n")
        // this filters out "unnamed" logs: https://yarnpkg.com/advanced/error-codes/#yn0000---unnamed
        // this includes a list of packed files and the "summary output" like: "Failed with errors in 0s 75ms"
        // those are not that interesting so we reduce the noise by dropping them
        .filter(line => !/YN0000:/.test(line))
        .join("\n");
      error(`an error occurred while publishing ${pkgName}:`, `\n${output}`);
      return { published: false };
    }

    // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // Note that the `--json` output is always printed at the end so this should work
    let json =
      getLastJsonObjectFromString(stderr.toString()) ||
      getLastJsonObjectFromString(stdout.toString());

    if (json?.error) {
      if (shouldHandleOtp && isOtpError(json.error)) {
        if (twoFactorState.token !== null) {
          // the current otp code must be invalid since it errored
          twoFactorState.token = null;
        }
        // just in case this isn't already true
        twoFactorState.isRequired = Promise.resolve(true);
        return internalPublish(pkgName, opts, twoFactorState);
      }
      error(
        `an error occurred while publishing ${pkgName}: ${json.error.code}`,
        json.error.summary,
        json.error.detail ? "\n" + json.error.detail : ""
      );
    }
    error(stderr);
    return { published: false };
  }

  return { published: true };
}

export function publish(
  pkgName: string,
  opts: { cwd: string; access?: string; tag: string },
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  // If there are many packages to be published, it's better to limit the
  // concurrency to avoid unwanted errors, for example from npm.
  return npmRequestLimit(() =>
    npmPublishLimit(() => internalPublish(pkgName, opts, twoFactorState))
  );
}
