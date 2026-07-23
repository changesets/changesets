import path from "node:path";
import { exec } from "tinyexec";
import { isAlreadyPublishedError } from "./common.ts";
import type { PackageInfo, PublishResult, PublishTool } from "./types.ts";

type BunCommandError = {
  code?: string;
  message?: string;
};

const webAuthPrompt = "Authenticate your account at";

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
  const args = ["--access", release.access, "--tag", release.tag];
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
      cwd,
      stdio: interactive ? "inherit" : "pipe",
      env: sanitizeEnv(process.env),
    },
  });
  let webAuthDetected = false;
  let observedStdout = "";
  let observedStderr = "";
  if (!interactive) {
    const detectWebAuth = () => {
      if (
        observedStdout.includes(webAuthPrompt) ||
        observedStderr.includes(webAuthPrompt)
      ) {
        webAuthDetected = true;
        publishProcess.kill();
      }
    };
    publishProcess.process?.stdout?.on("data", (chunk: Buffer | string) => {
      observedStdout += chunk.toString();
      detectWebAuth();
    });
    publishProcess.process?.stderr?.on("data", (chunk: Buffer | string) => {
      observedStderr += chunk.toString();
      detectWebAuth();
    });
  }
  const { exitCode, stdout, stderr } = await publishProcess;
  const resultBase = { name: release.name, version: release.version };
  const error = getBunError(stdout, stderr);

  if (webAuthDetected) {
    return {
      ...resultBase,
      result: "failed",
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
  if (isAlreadyPublishedError(error.message ?? "")) {
    return {
      ...resultBase,
      result: "failed:already-published",
      code: error.code,
    } satisfies PublishResult;
  }

  if (/\b(otp|one-time pass(?:word)?)\b/i.test(error.message ?? "")) {
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
