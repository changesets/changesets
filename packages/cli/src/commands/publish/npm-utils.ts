import { ExitError } from "@changesets/errors";
import { error, info, warn } from "@changesets/logger";
import pLimit from "p-limit";
import chalk from "chalk";
import spawn from "spawndamnit";
import { askQuestion } from "../../utils/cli-utilities";
// @ts-ignore
import isCI from "is-ci";
import { TwoFactorState } from "../../utils/types";

const npmRequestLimit = pLimit(40);

function getCorrectRegistry() {
  let registry =
    process.env.npm_config_registry === "https://registry.yarnpkg.com"
      ? undefined
      : process.env.npm_config_registry;
  return registry;
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
  let json = JSON.parse(result.stdout.toString());
  if (json.error) {
    error(
      `an error occurred while running \`npm profile get\`: ${json.error.code}`
    );
    error(json.error.summary);
    if (json.error.summary) error(json.error.summary);
    throw new ExitError(1);
  }
  return json.tfa.mode === "auth-and-writes";
}

export function getPackageInfo(pkgName: string) {
  return npmRequestLimit(async () => {
    info(`npm info ${pkgName}`);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    const envOverride = {
      npm_config_registry: getCorrectRegistry()
    };

    let result = await spawn("npm", ["info", pkgName, "--json"], {
      env: Object.assign({}, process.env, envOverride)
    });

    return JSON.parse(result.stdout.toString());
  });
}

export async function infoAllow404(pkgName: string) {
  let pkgInfo = await getPackageInfo(pkgName);
  if (pkgInfo.error && pkgInfo.error.code === "E404") {
    warn(`Recieved 404 for npm info ${chalk.cyan(`"${pkgName}"`)}`);
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    error(
      `Recieved an unknown error code: ${
        pkgInfo.error.code
      } for npm info ${chalk.cyan(`"${pkgName}"`)}`
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

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  pkgName: string,
  opts: { cwd: string; access?: string; tag: string },
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  let publishFlags = opts.access ? ["--access", opts.access] : [];
  publishFlags.push("--tag", opts.tag);
  if ((await twoFactorState.isRequired) && !isCI) {
    let otpCode = await getOtpCode(twoFactorState);
    publishFlags.push("--otp", otpCode);
  }

  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    npm_config_registry: getCorrectRegistry()
  };
  let { stdout } = await spawn("npm", ["publish", "--json", ...publishFlags], {
    cwd: opts.cwd,
    env: Object.assign({}, process.env, envOverride)
  });
  // New error handling. NPM's --json option is included alongside the `prepublish and
  // `postpublish` contents in terminal. We want to handle this as best we can but it has
  // some struggles
  // Note that both pre and post publish hooks are printed before the json out, so this works.
  let json = JSON.parse(stdout.toString().replace(/[^{]*/, ""));

  if (json.error) {
    // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
    if (
      (json.error.code === "EOTP" ||
        (json.error.code === "E401" &&
          json.error.detail.includes("--otp=<code>"))) &&
      !isCI
    ) {
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
    return { published: false };
  }
  return { published: true };
}

export function publish(
  pkgName: string,
  opts: { cwd: string; access?: string; tag: string },
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  return npmRequestLimit(() => {
    return internalPublish(pkgName, opts, twoFactorState);
  });
}
