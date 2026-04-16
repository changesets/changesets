import { MarkdownFormat } from "@changesets/types";
import { spawn } from "child_process";
import path from "path";
import prettier from "prettier";

type LegacyFormatOptions = {
  format?: MarkdownFormat;
  prettier?: boolean;
};

type PackageJsonWithBin = {
  bin?: string | Record<string, string>;
};

type ModuleNotFoundError = Error & {
  code?: string;
};

function resolvePackageJsonPath(packageName: "oxfmt", cwd: string) {
  try {
    return require.resolve(`${packageName}/package.json`, { paths: [cwd] });
  } catch (err) {
    if (!err || (err as ModuleNotFoundError).code !== "MODULE_NOT_FOUND") {
      throw err;
    }

    return require.resolve(`${packageName}/package.json`);
  }
}

function getPrettierInstance(cwd: string): typeof prettier {
  try {
    return require(require.resolve("prettier", { paths: [cwd] }));
  } catch (err) {
    if (!err || (err as ModuleNotFoundError).code !== "MODULE_NOT_FOUND") {
      throw err;
    }

    return prettier;
  }
}

function getOxfmtBinaryPath(cwd: string) {
  const packageJsonPath = resolvePackageJsonPath("oxfmt", cwd);
  const packageJson = require(packageJsonPath) as PackageJsonWithBin;
  const bin = packageJson.bin;

  const relativeBinPath =
    typeof bin === "string"
      ? bin
      : bin?.oxfmt ?? (bin ? Object.values(bin)[0] : undefined);

  if (!relativeBinPath) {
    throw new Error("Could not determine the oxfmt binary path.");
  }

  return path.join(path.dirname(packageJsonPath), relativeBinPath);
}

async function formatWithPrettier(
  content: string,
  filePath: string,
  cwd: string
) {
  const prettierInstance = getPrettierInstance(cwd);

  return prettierInstance.format(content, {
    ...(await prettierInstance.resolveConfig(filePath)),
    filepath: filePath,
    parser: "markdown",
  });
}

async function formatWithOxfmt(content: string, filePath: string, cwd: string) {
  const binaryPath = getOxfmtBinaryPath(cwd);

  return new Promise<string>((resolve, reject) => {
    const child = spawn(binaryPath, ["--stdin-filepath", filePath], { cwd });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const errorMessage = stderr.trim();
      reject(
        new Error(
          errorMessage
            ? `Failed to format markdown with oxfmt: ${errorMessage}`
            : "Failed to format markdown with oxfmt."
        )
      );
    });

    child.stdin.end(content);
  });
}

export function getMarkdownFormat(
  options?: LegacyFormatOptions
): MarkdownFormat {
  if (options?.format !== undefined) {
    return options.format;
  }

  return options?.prettier === false ? false : "prettier";
}

export async function formatMarkdown(
  content: string,
  filePath: string,
  cwd: string,
  format: MarkdownFormat
) {
  if (format === false) {
    return content;
  }

  if (format === "oxfmt") {
    return formatWithOxfmt(content, filePath, cwd);
  }

  return formatWithPrettier(content, filePath, cwd);
}
