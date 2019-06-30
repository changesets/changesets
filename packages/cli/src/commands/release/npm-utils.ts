import logger from "../../utils/logger";
import pLimit from "p-limit";
import chalk from "chalk";
import spawn from "projector-spawn";
import { askQuestion } from "../../utils/cli";
// @ts-ignore
import isCI from "is-ci";

const npmRequestLimit = pLimit(40);

function getCorrectRegistry() {
  let registry =
    process.env.npm_config_registry === "https://registry.yarnpkg.com"
      ? undefined
      : process.env.npm_config_registry;
  return registry;
}

export function info(pkgName: string) {
  return npmRequestLimit(async () => {
    logger.info(`npm info ${pkgName}`);

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

    return JSON.parse(result.stdout);
  });
}

export async function infoAllow404(pkgName: string) {
  let pkgInfo = await info(pkgName);
  if (pkgInfo.error && pkgInfo.error.code === "E404") {
    logger.warn(`Recieved 404 for npm info ${chalk.cyan(`"${pkgName}"`)}`);
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    logger.warn(
      `Recieved an unknown error code: ${
        pkgInfo.error.code
      } for npm info ${chalk.cyan(`"${pkgName}"`)}`
    );
    logger.warn(pkgInfo);
    return { published: false, pkgInfo: {} };
  }
  return { published: true, pkgInfo };
}

let requiresOtpCode = false;

let currentOtpCode: string | null = null;

let otpAskLimit = pLimit(1);

let askForOtpCode = () =>
  otpAskLimit(() => {
    if (currentOtpCode !== null) return currentOtpCode;
    logger.info(
      "This operation requires a one-time password from your authenticator."
    );
    return askQuestion("Enter one-time password:");
  });

let getOtpCode = async () => {
  if (currentOtpCode !== null) {
    return currentOtpCode;
  }
  currentOtpCode = await askForOtpCode();
  return currentOtpCode;
};

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  pkgName: string,
  opts: { cwd?: string; access?: string } = {}
): Promise<{ published: boolean }> {
  let publishFlags = opts.access ? ["--access", opts.access] : [];
  if (requiresOtpCode) {
    let otpCode = await getOtpCode();
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

  let json = JSON.parse(stdout);
  if (json.error) {
    if (json.error.code === "EOTP" && !isCI) {
      if (currentOtpCode !== null) {
        // the current otp code must be invalid since it errored
        currentOtpCode = null;
      }
      requiresOtpCode = true;
      return internalPublish(pkgName, opts);
    }
    logger.error(
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
  opts: { cwd?: string; access?: string } = {}
): Promise<{ published: boolean }> {
  return npmRequestLimit(() => {
    return internalPublish(pkgName, opts);
  });
}
