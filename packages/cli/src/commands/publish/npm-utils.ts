import { ExitError } from "@changesets/errors";
import { error, info, warn } from "@changesets/logger";
import { AccessType, PackageJSON } from "@changesets/types";
import pLimit from "p-limit";
import { detect } from "package-manager-detector";
import pc from "picocolors";
import spawn from "spawndamnit";
import semverParse from "semver/functions/parse";
import { askQuestion } from "../../utils/cli-utilities";
import { isCI } from "ci-info";
import { TwoFactorState } from "../../utils/types";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString";

interface PublishOptions {
  cwd: string;
  publishDir: string;
  access: AccessType;
  tag: string;
}

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

interface RegistryInfo {
  scope?: string;
  registry: string;
}

export function getCorrectRegistry(packageJson?: PackageJSON): RegistryInfo {
  const packageName = packageJson?.name;

  if (packageName?.startsWith("@")) {
    const scope = packageName.split("/")[0];
    const scopedRegistry =
      packageJson!.publishConfig?.[`${scope}:registry`] ||
      process.env[`npm_config_${scope}:registry`];
    if (scopedRegistry) {
      return {
        scope,
        registry: scopedRegistry,
      };
    }
  }

  const registry =
    packageJson?.publishConfig?.registry || process.env.npm_config_registry;

  return {
    scope: undefined,
    registry:
      !registry || registry === "https://registry.yarnpkg.com"
        ? "https://registry.npmjs.org"
        : registry,
  };
}

async function getPublishTool(
  cwd: string
): Promise<{ name: "npm" } | { name: "pnpm"; shouldAddNoGitChecks: boolean }> {
  const pm = await detect({ cwd });
  if (!pm || pm.name !== "pnpm") return { name: "npm" };
  try {
    let result = await spawn("pnpm", ["--version"], { cwd });
    let version = result.stdout.toString().trim();
    let parsed = semverParse(version);
    return {
      name: "pnpm",
      shouldAddNoGitChecks:
        parsed?.major === undefined ? false : parsed.major >= 5,
    };
  } catch (e) {
    return {
      name: "pnpm",
      shouldAddNoGitChecks: false,
    };
  }
}

async function getNpmAuthMethod(): Promise<"otp" | "webauthn" | "none"> {
  try {
    const { scope, registry } = getCorrectRegistry();
    const envOverride = {
      [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]:
        registry,
    };

    let result = await spawn("npm", ["profile", "get", "tfa", "--json"], {
      env: Object.assign({}, process.env, envOverride),
    });

    if (result.code !== 0) {
      return "none";
    }

    let json = jsonParse(result.stdout.toString());

    // Check if 2FA is disabled
    if (!json.tfa || !json.tfa.mode || json.tfa.mode === "disabled") {
      return "none";
    }

    // Check for WebAuthn/Passkey
    if (json.tfa.mode === "auth-and-writes") {
      // Try to detect if WebAuthn is configured
      // npm profile will show pending status for webauthn
      const tfaStatus = json.tfa.pending || json.tfa.mode;
      if (
        tfaStatus.toLowerCase().includes("webauthn") ||
        tfaStatus.toLowerCase().includes("passkey")
      ) {
        return "webauthn";
      }
      return "otp";
    }

    return "none";
  } catch (error) {
    return "none";
  }
}

export async function getTokenIsRequired() {
  const { scope, registry } = getCorrectRegistry();
  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry,
  };
  let result = await spawn("npm", ["profile", "get", "--json"], {
    env: Object.assign({}, process.env, envOverride),
  });
  if (result.code !== 0) {
    error(
      "error while checking if token is required",
      result.stderr.toString().trim() || result.stdout.toString().trim()
    );
    return false;
  }
  let json = jsonParse(result.stdout.toString());
  if (json.error || !json.tfa || !json.tfa.mode) {
    return false;
  }
  return json.tfa.mode === "auth-and-writes";
}

export function getPackageInfo(packageJson: PackageJSON) {
  return npmRequestLimit(async () => {
    info(`npm info ${packageJson.name}`);

    const { scope, registry } = getCorrectRegistry(packageJson);

    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    let result = await spawn("npm", [
      "info",
      packageJson.name,
      `--${scope ? `${scope}:` : ""}registry=${registry}`,
      "--json",
    ]);

    // Github package registry returns empty string when calling npm info
    // for a non-existent package instead of a E404
    if (result.stdout.toString() === "") {
      return {
        error: {
          code: "E404",
        },
      };
    }
    return jsonParse(result.stdout.toString());
  });
}

export async function infoAllow404(packageJson: PackageJSON) {
  let pkgInfo = await getPackageInfo(packageJson);
  if (pkgInfo.error?.code === "E404") {
    warn(`Received 404 for npm info ${pc.cyan(`"${packageJson.name}"`)}`);
    return { published: false, pkgInfo: {} };
  }
  if (pkgInfo.error) {
    error(
      `Received an unknown error code: ${
        pkgInfo.error.code
      } for npm info ${pc.cyan(`"${packageJson.name}"`)}`
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

async function handleWebAuthnAuth(packageJson: PackageJSON): Promise<boolean> {
  info(
    `WebAuthn/Passkey authentication required for ${pc.cyan(
      `"${packageJson.name}"`
    )}`
  );
  info("Opening browser for authentication...");

  const { scope, registry } = getCorrectRegistry(packageJson);
  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry,
  };

  try {
    // Trigger web-based authentication
    let result = await spawn("npm", ["login", "--auth-type=web"], {
      env: Object.assign({}, process.env, envOverride),
      stdio: "inherit", // Allow interactive authentication
    });

    if (result.code === 0) {
      info("Authentication successful!");
      return true;
    } else {
      error("WebAuthn authentication failed");
      return false;
    }
  } catch (err) {
    error("Error during WebAuthn authentication:", err);
    return false;
  }
}

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  packageJson: PackageJSON,
  opts: PublishOptions,
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  let publishTool = await getPublishTool(opts.cwd);
  let publishFlags = opts.access ? ["--access", opts.access] : [];
  publishFlags.push("--tag", opts.tag);

  if ((await twoFactorState.isRequired) && !isCI) {
    let otpCode = await getOtpCode(twoFactorState);
    publishFlags.push("--otp", otpCode);
  }
  if (publishTool.name === "pnpm" && publishTool.shouldAddNoGitChecks) {
    publishFlags.push("--no-git-checks");
  }

  const { scope, registry } = getCorrectRegistry(packageJson);

  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry,
  };

  let { code, stdout, stderr } =
    publishTool.name === "pnpm"
      ? await spawn("pnpm", ["publish", "--json", ...publishFlags], {
          env: Object.assign({}, process.env, envOverride),
          cwd: opts.cwd,
        })
      : await spawn(
          publishTool.name,
          ["publish", opts.publishDir, "--json", ...publishFlags],
          {
            env: Object.assign({}, process.env, envOverride),
          }
        );

  if (code !== 0) {
    let json =
      getLastJsonObjectFromString(stderr.toString()) ||
      getLastJsonObjectFromString(stdout.toString());

    if (json?.error) {
      const errorCode = json.error.code;
      const errorDetail = json.error.detail || "";

      // UPDATED: Enhanced 2FA error handling with WebAuthn support
      if (
        (errorCode === "EOTP" ||
          (errorCode === "E401" && errorDetail.includes("--otp=")) ||
          (errorCode === "E401" && errorDetail.includes("authentication"))) &&
        !isCI
      ) {
        // Detect authentication method
        const authMethod = await getNpmAuthMethod();

        if (authMethod === "webauthn") {
          info("Detected WebAuthn/Passkey authentication is required");

          // Attempt WebAuthn authentication
          const authSuccess = await handleWebAuthnAuth(packageJson);

          if (authSuccess) {
            // Retry publish after successful authentication
            return internalPublish(packageJson, opts, {
              token: null,
              isRequired: Promise.resolve(true),
            });
          } else {
            error(
              "Failed to authenticate with WebAuthn. Please try again or check your npm configuration."
            );
            return { published: false };
          }
        } else {
          // Use traditional OTP flow
          if (twoFactorState.token !== null) {
            warn("Invalid OTP code provided. Please try again.");
            twoFactorState.token = null;
          }
          twoFactorState.isRequired = Promise.resolve(true);
          return internalPublish(packageJson, opts, twoFactorState);
        }
      }

      error(
        `an error occurred while publishing ${packageJson.name}: ${json.error.code}`,
        json.error.summary,
        json.error.detail ? "\n" + json.error.detail : ""
      );
    }

    error(stderr.toString() || stdout.toString());
    return { published: false };
  }
  return { published: true };
}

export function publish(
  packageJson: PackageJSON,
  opts: PublishOptions,
  twoFactorState: TwoFactorState
): Promise<{ published: boolean }> {
  // If there are many packages to be published, it's better to limit the
  // concurrency to avoid unwanted errors, for example from npm.
  return npmRequestLimit(() =>
    npmPublishLimit(() => internalPublish(packageJson, opts, twoFactorState))
  );
}
