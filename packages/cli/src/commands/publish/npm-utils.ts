import { spawnSync } from "child_process";
import { ExitError } from "@changesets/errors";
import { error, info, warn } from "@changesets/logger";
import { AccessType, PackageJSON } from "@changesets/types";
import { detect } from "package-manager-detector";
import pc from "picocolors";
import spawn from "spawndamnit";
import semverParse from "semver/functions/parse";
import { createPromiseQueue } from "../../utils/createPromiseQueue";
import { TwoFactorState } from "../../utils/types";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString";
import { requiresDelegatedAuth } from "./publishPackages";

interface PublishOptions {
  cwd: string;
  publishDir: string;
  access: AccessType;
  tag: string;
}

const NPM_REQUEST_CONCURRENCY_LIMIT = 40;
const NPM_PUBLISH_CONCURRENCY_LIMIT = 10;

const npmRequestQueue = createPromiseQueue(NPM_REQUEST_CONCURRENCY_LIMIT);
const npmPublishQueue = createPromiseQueue(NPM_PUBLISH_CONCURRENCY_LIMIT);

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

function normalizeRegistry(registry: string | undefined) {
  return registry && registry.replace(/\/+$/, "");
}

export function getCorrectRegistry(packageJson?: PackageJSON): RegistryInfo {
  const packageName = packageJson?.name;

  if (packageName?.startsWith("@")) {
    const scope = packageName.split("/")[0];
    const scopedRegistry = normalizeRegistry(
      packageJson!.publishConfig?.[`${scope}:registry`] ||
        process.env[`npm_config_${scope}:registry`]
    );
    if (scopedRegistry) {
      return {
        scope,
        registry: scopedRegistry,
      };
    }
  }

  const registry = normalizeRegistry(
    packageJson?.publishConfig?.registry || process.env.npm_config_registry
  );

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
  return npmRequestQueue.add(async () => {
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

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  packageJson: PackageJSON,
  opts: PublishOptions,
  twoFactorState: TwoFactorState
): Promise<{ published: boolean; allowRetry?: boolean }> {
  const publishTool = await getPublishTool(opts.cwd);

  const publishFlags = opts.access ? ["--access", opts.access] : [];
  publishFlags.push("--tag", opts.tag);
  if (publishTool.name === "pnpm" && publishTool.shouldAddNoGitChecks) {
    publishFlags.push("--no-git-checks");
  }

  const { scope, registry } = getCorrectRegistry(packageJson);

  // Due to a super annoying issue in yarn, we have to manually override this env variable
  // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
  const envOverride = {
    [scope ? `npm_config_${scope}:registry` : "npm_config_registry"]: registry,
  };

  if (await requiresDelegatedAuth(twoFactorState)) {
    const result =
      publishTool.name === "pnpm"
        ? spawnSync("pnpm", ["publish", ...publishFlags], {
            env: Object.assign({}, process.env, envOverride),
            cwd: opts.cwd,
          })
        : spawnSync(
            publishTool.name,
            ["publish", opts.publishDir, ...publishFlags],
            {
              env: Object.assign({}, process.env, envOverride),
            }
          );

    if (result.status === 0) {
      twoFactorState.allowConcurrency = true;
      // bump for remaining packages
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { published: true };
    }

    return { published: false };
  }

  // in the delegated mode we don't need the json output
  // as we won't be handling the auth errors
  publishFlags.push("--json");
  if (twoFactorState.token) {
    publishFlags.push("--otp", twoFactorState.token);
  }

  let { code, stdout, stderr } =
    publishTool.name === "pnpm"
      ? await spawn("pnpm", ["publish", ...publishFlags], {
          env: Object.assign({}, process.env, envOverride),
          cwd: opts.cwd,
        })
      : await spawn(
          publishTool.name,
          ["publish", opts.publishDir, ...publishFlags],
          {
            env: Object.assign({}, process.env, envOverride),
          }
        );

  if (code !== 0) {
    // NPM's --json output is included alongside the `prepublish` and `postpublish` output in terminal
    // We want to handle this as best we can but it has some struggles:
    // - output of those lifecycle scripts can contain JSON
    // - npm7 has switched to printing `--json` errors to stderr (https://github.com/npm/cli/commit/1dbf0f9bb26ba70f4c6d0a807701d7652c31d7d4)
    // Note that the `--json` output is always printed at the end so this should work
    let json =
      getLastJsonObjectFromString(stderr.toString()) ||
      getLastJsonObjectFromString(stdout.toString());

    if (json?.error) {
      // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
      if (
        (json.error.code === "EOTP" ||
          (json.error.code === "E401" &&
            json.error.detail?.includes("--otp=<code>"))) &&
        process.stdin.isTTY
      ) {
        // the current otp code must be invalid since it errored
        twoFactorState.token = null;
        // just in case this isn't already true
        twoFactorState.isRequired = Promise.resolve(true);
        twoFactorState.allowConcurrency = false;
        npmPublishQueue.setConcurrency(1);
        return {
          published: false,
          // given we have just adjusted the concurrency, we need to handle the retries in the layer that requeues the publish
          // calling internalPublish again would allow concurrent failures to run again concurrently
          // but only one retried publish should get delegated to the npm cli and other ones should "await" its successful result before being retried
          allowRetry: true,
        };
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
  return npmRequestQueue.add(async () => {
    if (await requiresDelegatedAuth(twoFactorState)) {
      npmPublishQueue.setConcurrency(1);
    }

    let result: { published: boolean; allowRetry?: boolean };
    do {
      result = await npmPublishQueue.add(() =>
        internalPublish(packageJson, opts, twoFactorState)
      );
    } while (result.allowRetry);

    return { published: result.published };
  });
}
