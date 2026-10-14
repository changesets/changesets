import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { exec } from "tinyexec";
import { isAlreadyPublishedError } from "./common.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

type BunCommandError = {
  code?: string;
  message?: string;
};

const webAuthPrompt =
  "\nAuthenticate your account at (press ENTER to open in browser):";
const directoryError = {
  message:
    "Bun does not support publishing a different directory with publishConfig.directory. Publish from the workspace package directory or supply a prebuilt tarball with --from-pack-dir.",
};

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    NPM_CONFIG_OTP: undefined,
    npm_config_otp: undefined,
  };
}

function getBunError(stdout: string, stderr: string): BunCommandError {
  // Bun can print the OTP prompt to stdout and the EOF error to stderr.
  // Preserve both so authentication challenges can be retried interactively.
  const output = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
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

export const pack: PublishTool["pack"] = async ({
  pkg,
  packDir,
  tarballPath,
}) => {
  if (path.resolve(packDir) !== path.resolve(pkg.dir)) {
    return { error: directoryError };
  }
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
  const resultBase = { name: release.name, version: release.version };
  if (
    !tarballPath &&
    pkg.packageJson.publishConfig?.directory &&
    path.resolve(pkg.dir, pkg.packageJson.publishConfig.directory) !==
      path.resolve(pkg.dir)
  ) {
    return { ...resultBase, result: "failed", ...directoryError };
  }
  const args = ["--access", release.access, "--tag", release.tag];
  // The captured attempt must report an OTP challenge instead of waiting for
  // browser authentication. Interactive retries keep Bun's default web flow.
  if (!interactive) args.push("--auth-type", "legacy");
  if (otpCode) args.push("--otp", otpCode);
  // Bun resolves positional tarballs from the workspace root rather than cwd,
  // so an absolute path is needed for artifacts outside the package directory.
  if (tarballPath) args.unshift(tarballPath);

  const publishProcess = exec("bun", ["publish", ...args], {
    nodePath: false,
    // Close piped stdin so Bun's CLI OTP prompt receives EOF instead of
    // waiting forever. Yarn gets a fake OTP to force its JSON error path;
    // Bun has no JSON publish mode and reports the EOF itself.
    ...(!interactive && { stdin: "" }),
    nodeOptions: {
      // Tarballs are already packed. Keep workspace registry/auth discovery
      // even when the source manifest specifies a different publish directory.
      cwd: pkg.dir,
      stdio: interactive ? "inherit" : "pipe",
      env: sanitizeEnv(process.env),
    },
  });
  let webAuthDetected = false;
  const watchStream = () => {
    let observed = "\n";
    return (chunk: Buffer | string) => {
      observed += chunk.toString();
      if (
        !webAuthDetected &&
        stripVTControlCharacters(observed).includes(webAuthPrompt)
      ) {
        webAuthDetected = true;
        publishProcess.kill();
      }
      observed = observed.slice(-webAuthPrompt.length * 2);
    };
  };
  const watchStdout = watchStream();
  const watchStderr = watchStream();
  const child = publishProcess.process;
  if (!interactive) {
    child?.stdout?.on("data", watchStdout);
    child?.stderr?.on("data", watchStderr);
  }
  const { exitCode, stdout, stderr } = await Promise.resolve(
    publishProcess,
  ).finally(() => {
    child?.stdout?.off("data", watchStdout);
    child?.stderr?.off("data", watchStderr);
  });
  const error = getBunError(stdout, stderr);

  if (webAuthDetected) {
    return {
      ...resultBase,
      result: "failed:needs-2fa",
      message:
        "Bun attempted web authentication during a non-interactive publish. The publish was stopped because Bun does not exit in this mode. Provide an OTP through the Changesets --otp option or NPM_CONFIG_OTP.",
    } satisfies PublishResult;
  }
  if (exitCode === 0) {
    return {
      ...resultBase,
      result: "published",
    } satisfies PublishResult;
  }
  if (
    (error.code === "E403" || error.code === "E409") &&
    isAlreadyPublishedError(error.message ?? "")
  ) {
    return {
      ...resultBase,
      result: "failed:already-published",
      code: error.code,
    } satisfies PublishResult;
  }

  if (
    (error.code === "E401" &&
      /\b(?:one-time pass(?:word)?|invalid OTP|OTP (?:required|invalid|expired))\b/i.test(
        stderr,
      )) ||
    (/(?:^|\n)\w+: failed to read OTP input\s*$/m.test(stderr) &&
      stdout.includes("This operation requires a one-time password."))
  ) {
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
