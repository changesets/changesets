import path from "node:path";
import { exec } from "tinyexec";
import { isAlreadyPublishedError } from "./common.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

type BunCommandError = {
  code?: string;
  message?: string;
};

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NPM_CONFIG_OTP: undefined,
    npm_config_otp: undefined,
  };
}

function getBunError(stdout: string, stderr: string): BunCommandError {
  const output = stderr || stdout;
  const statusCode = output.match(/(?:^|\n)(\d{3})(?: [^:\n]+)?:/)?.[1];
  return {
    code: statusCode ? `E${statusCode}` : undefined,
    message: output.trim() || undefined,
  };
}

function parseInfoResult({
  exitCode,
  stdout,
  stderr,
}: import("tinyexec").Output):
  | { info: PackageInfo }
  | { error: BunCommandError } {
  if (exitCode !== 0) {
    return { error: getBunError(stdout, stderr) };
  }
  return { info: JSON.parse(stdout) as PackageInfo };
}

async function getPackageInfo(cwd: string, spec: string) {
  const result = await exec("bun", ["info", spec, "--json", "--no-cache"], {
    nodePath: false,
    nodeOptions: { cwd },
  });
  const parsed = parseInfoResult(result);
  if ("error" in parsed) {
    return parsed;
  }

  const tagsResult = await exec(
    "bun",
    ["info", spec, "dist-tags", "--json", "--no-cache"],
    {
      nodePath: false,
      nodeOptions: { cwd },
    },
  );
  if (tagsResult.exitCode !== 0) {
    return { error: getBunError(tagsResult.stdout, tagsResult.stderr) };
  }

  return {
    info: {
      ...parsed.info,
      "dist-tags": JSON.parse(tagsResult.stdout) as Record<string, string>,
    },
  };
}

// -- PublishTool -- //

export const name = "bun" satisfies PublishTool["name"];

export const info: PublishTool["info"] = async ({ pkg }) => {
  const { packageJson } = pkg;
  let result = await getPackageInfo(pkg.dir, packageJson.name);
  if (
    "error" in result &&
    (result.error.code === "E404" ||
      result.error.message?.includes("No matching version found"))
  ) {
    result = await getPackageInfo(
      pkg.dir,
      `${packageJson.name}@${packageJson.version}`,
    );
  }
  if ("error" in result) {
    return result.error.code === "E404" ||
      result.error.message?.includes("No matching version found")
      ? { published: false }
      : { error: result.error };
  }
  return { published: true, info: result.info };
};

export const pack: PublishTool["pack"] = async ({ packDir, tarballPath }) => {
  const { exitCode, stdout, stderr } = await exec(
    "bun",
    ["pm", "pack", "--filename", tarballPath],
    {
      nodePath: false,
      nodeOptions: { cwd: packDir },
    },
  );
  if (exitCode !== 0) {
    return { error: getBunError(stdout, stderr) };
  }
  return { tarballPath };
};

export const getOtpCode: PublishTool["getOtpCode"] = (otp?: string) =>
  otp || process.env.NPM_CONFIG_OTP || process.env.npm_config_otp || null;

export const publish: PublishTool["publish"] = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}) => {
  const cwd = pkg.packageJson.publishConfig?.directory
    ? path.resolve(pkg.dir, pkg.packageJson.publishConfig.directory)
    : pkg.dir;
  const args = [
    "--access",
    release.access,
    "--tag",
    release.tag,
    "--auth-type",
    "legacy",
  ];
  if (otpCode) args.push("--otp", otpCode);
  // Bun resolves positional tarballs from the workspace root rather than cwd,
  // so an absolute path is needed for artifacts outside the package directory.
  if (tarballPath) args.unshift(tarballPath);

  const { exitCode, stdout, stderr } = await exec("bun", ["publish", ...args], {
    nodePath: false,
    ...(!interactive && { stdin: "" }),
    nodeOptions: {
      cwd,
      stdio: interactive ? "inherit" : "pipe",
      env: sanitizeEnv(process.env),
    },
  });
  const resultBase = { name: release.name, version: release.version };
  const output = [stdout, stderr].filter(Boolean).join("\n");

  if (exitCode === 0) {
    return {
      ...resultBase,
      result: "published",
    } satisfies PublishResult;
  }
  if (isAlreadyPublishedError(output)) {
    return {
      ...resultBase,
      result: "failed:already-published",
      code: getBunError(stdout, stderr).code,
    } satisfies PublishResult;
  }

  const error = getBunError(stdout, stderr);
  if (/\b(otp|one-time pass(?:word)?)\b/i.test(output)) {
    return {
      ...resultBase,
      result: "failed:needs-2fa",
      ...error,
    } satisfies PublishResult;
  }
  return {
    ...resultBase,
    result: "failed",
    ...error,
  } satisfies PublishResult;
};
