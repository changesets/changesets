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
const NPM_REGISTRY = "https://registry.npmjs.org";
const YARN_REGISTRY = "https://registry.yarnpkg.com";

export const npmRequestQueue = createPromiseQueue(
  NPM_REQUEST_CONCURRENCY_LIMIT
);
export const npmPublishQueue = createPromiseQueue(
  NPM_PUBLISH_CONCURRENCY_LIMIT
);

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

export const isCustomRegistry = (registry?: string): boolean => {
  return (
    !!registry &&
    registry !== NPM_REGISTRY &&
    registry !== `${NPM_REGISTRY}/` &&
    registry !== YARN_REGISTRY &&
    registry !== `${YARN_REGISTRY}/`
  );
};

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
      !registry || !isCustomRegistry(registry) ? NPM_REGISTRY : registry,
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

type InfoTool =
  | { name: "npm" }
  | { name: "pnpm" }
  | { name: "yarn-classic" }
  | { name: "yarn-berry" };

async function getInfoTool(cwd: string): Promise<InfoTool> {
  const pm = await detect({ cwd });
  if (pm?.name === "pnpm") return { name: "pnpm" };
  if (pm?.name === "yarn") {
    return pm.agent === "yarn@berry"
      ? { name: "yarn-berry" }
      : { name: "yarn-classic" };
  }
  return { name: "npm" };
}

// yarn v1 returns {"type":"error","data":"..."} (non-empty stdout) when a package or
// version isn't found, unlike npm/pnpm which return empty stdout.
function isYarnClassicError(output: string): boolean {
  try {
    return JSON.parse(output)?.type === "error";
  } catch {
    return false;
  }
}

// Queries the registry for package info using the detected package manager.
// Tool-specific behaviour:
//
// npm / pnpm:
// - Bare package name starts with version string `'latest'`. If
//   `dist-tags['latest']` exists, it's replaced with that value (e.g.
//   `'1.0.0'`). Then ALL versions are filtered through
//   `semver.satisfies(v, version, loose=true)`. When `latest` resolved to
//   an exact version, this is effectively an exact match. When `latest`
//   doesn't exist, the literal string `'latest'` reaches satisfies and
//   matches nothing — zero results, empty stdout.
// - Prereleases are invisible: satisfies runs WITHOUT `includePrerelease`,
//   so no range (not even `*`) matches prerelease versions.
// - When at least one version matches, the JSON output includes a `versions`
//   array with ALL published versions including prereleases (bleeds through
//   from the packument, unfiltered).
// - Registry is passed via `--registry` (or `--<scope>:registry`) CLI flag.
//
// yarn berry:
// - Uses `yarn npm info`, which reads the registry from `.yarnrc.yml` rather
//   than accepting a CLI `--registry` flag.
// - Returns npm-compatible JSON directly (no envelope wrapping).
//
// yarn classic (v1):
// - Uses `yarn info`, which wraps the result in `{ type: "inspect", data: {...} }`.
//   The wrapper is stripped before returning so callers get the raw packument shape.
// - Registry is passed via `--registry` (not the scoped `--@scope:registry` form,
//   which yarn v1 silently ignores).
// - Returns `{ type: "error", data: "..." }` (non-empty) instead of empty stdout
//   when a package or version isn't found.
//
// Two-query strategy (applies to all tools):
// - npmjs.org auto-assigns `latest` on first publish, so bare queries always
//   work there. GitHub Packages does NOT auto-assign `latest`, so the bare
//   query returns empty stdout (or a yarn-classic error) and we fall back to
//   an exact-version query.
// - The exact-version fallback only provides data when localVersion is already
//   published. For a new unpublished version both queries return empty →
//   no versions list → only-pre detection is not possible. Such packages
//   (e.g. GitHub Packages with no auto-latest) are published with
//   preState.tag rather than "latest".
export function getPackageInfo(packageJson: PackageJSON, cwd = process.cwd()) {
  return npmRequestQueue.add(async () => {
    info(`npm info ${packageJson.name}`);

    const { scope, registry } = getCorrectRegistry(packageJson);
    const infoTool = await getInfoTool(cwd);

    // yarn classic only understands --registry=<url>, not --@scope:registry=<url>
    const registryFlag =
      infoTool.name === "yarn-classic"
        ? `--registry=${registry}`
        : `--${scope ? `${scope}:` : ""}registry=${registry}`;

    const runInfoCommand = (pkgSpecifier: string) => {
      if (infoTool.name === "yarn-berry") {
        // yarn berry's `npm` subcommand returns npm-compatible JSON;
        // registry is read from .yarnrc.yml rather than a CLI flag
        return spawn("yarn", ["npm", "info", pkgSpecifier, "--json"], { cwd });
      }
      const cmd = infoTool.name === "yarn-classic" ? "yarn" : infoTool.name;
      return spawn(cmd, ["info", pkgSpecifier, registryFlag, "--json"], {
        cwd,
      });
    };

    // "no useful result" means empty stdout for npm/pnpm/yarn-berry, or a
    // {"type":"error"} response for yarn classic (which never returns empty stdout).
    const isEmptyResult = (output: string) =>
      output === "" ||
      (infoTool.name === "yarn-classic" && isYarnClassicError(output));

    // Bare query: when dist-tags.latest is set, returns the full `versions` array via packument
    // bleed-through, enabling only-pre detection downstream. Returns empty when no `latest` exists.
    let result = await runInfoCommand(packageJson.name);

    // Bare query returned nothing — retry with exact version specifier
    // to handle prerelease-only packages on registries without auto-`latest`.
    if (isEmptyResult(result.stdout.toString())) {
      result = await runInfoCommand(
        `${packageJson.name}@${packageJson.version}`
      );
    }

    // Normalize, just in case. The above prerelease-only package query should already have returned:
    // - either a result (when the package+version exists)
    // - or an error with: "code": "E404", "summary": "No match found for version $VERSION",
    if (isEmptyResult(result.stdout.toString())) {
      return {
        error: {
          code: "E404",
        },
      };
    }

    const parsed = jsonParse(result.stdout.toString());

    // yarn classic wraps packument data in { type: "inspect", data: {...} }
    if (infoTool.name === "yarn-classic" && parsed?.type === "inspect") {
      return parsed.data;
    }

    return parsed;
  });
}

export async function infoAllow404(packageJson: PackageJSON, cwd?: string) {
  let pkgInfo = await getPackageInfo(packageJson, cwd);
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

// we check `npm info` before publishing but `npm info` can return stale data at times
// so we need to gracefully handle this situation
function isAlreadyPublishedError(output: string): boolean {
  return output.includes(
    "cannot publish over the previously published version"
  );
}

type InternalPublishResult =
  | { result: "published" }
  | { result: "skipped" }
  | { result: "failed"; allowRetry?: boolean };

// we have this so that we can do try a publish again after a publish without
// the call being wrapped in the npm request limit and causing the publishes to potentially never run
async function internalPublish(
  packageJson: PackageJSON,
  opts: PublishOptions,
  twoFactorState: TwoFactorState
): Promise<InternalPublishResult> {
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

  if (requiresDelegatedAuth(twoFactorState)) {
    // it's not easily controllable but ideally no other work should happen until this is done
    // we specifically don't want any other output to interfere with the delegated auth flow
    const child =
      publishTool.name === "pnpm"
        ? spawn("pnpm", ["publish", ...publishFlags], {
            env: Object.assign({}, process.env, envOverride),
            cwd: opts.cwd,
            stdio: ["inherit", "inherit", "pipe"],
          })
        : spawn(
            publishTool.name,
            ["publish", opts.publishDir, ...publishFlags],
            {
              env: Object.assign({}, process.env, envOverride),
              stdio: ["inherit", "inherit", "pipe"],
            }
          );

    child.on("stderr", (data: Buffer) => process.stderr.write(data));

    const result = await child;

    if (result.code === 0) {
      twoFactorState.allowConcurrency = true;
      // bump for remaining packages
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { result: "published" };
    }

    // in the delegated mode all tested npm versions (v3-v10) log the error to stderr
    if (isAlreadyPublishedError(result.stderr.toString())) {
      // given this error happened in the delegated mode, the user was prompted to log in
      // for that reason, it's nice to show this warning to the user so they are not confused by the printed error
      warn(
        `${packageJson.name} is already published (likely a stale registry data led to a duplicate publish attempt)`
      );
      twoFactorState.allowConcurrency = true;
      npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);
      return { result: "skipped" };
    }

    return { result: "failed" };
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
      if (
        json.error.code === "E403" &&
        isAlreadyPublishedError(json.error.summary)
      ) {
        // we don't need to log anything here, it just turned out the version was already published so we gracefully exit the publish process
        return { result: "skipped" };
      }
      // The first case is no 2fa provided, the second is when the 2fa is wrong (timeout or wrong words)
      if (
        (json.error.code === "EOTP" ||
          (json.error.code === "E401" &&
            json.error.detail?.includes("--otp=<code>"))) &&
        process.stdin.isTTY
      ) {
        // the current otp code must be invalid since it errored
        twoFactorState.token = undefined;
        // just in case this isn't already true
        twoFactorState.isRequired = true;
        twoFactorState.allowConcurrency = false;
        npmPublishQueue.setConcurrency(1);
        return {
          result: "failed",
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
    return { result: "failed" };
  }
  return { result: "published" };
}

export function publish(
  packageJson: PackageJSON,
  opts: PublishOptions,
  twoFactorState: TwoFactorState
): Promise<{ result: "published" | "skipped" | "failed" }> {
  return npmRequestQueue.add(async () => {
    let result: InternalPublishResult;
    do {
      result = await npmPublishQueue.add(() =>
        internalPublish(packageJson, opts, twoFactorState)
      );
    } while (result.result === "failed" && result.allowRetry);

    return { result: result.result };
  });
}
