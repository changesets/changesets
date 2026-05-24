import fs from "node:fs/promises";
import path from "node:path";
import type { Config, Packages } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { type BaseIssue, getDotPath, safeParse } from "valibot";
import { normalizeWrittenConfig, WrittenConfigSchema } from "./config.ts";
import { validateConfigByRules } from "./rules.ts";

type ParseResult =
  | {
      config: Config;
      warnings: string[];
      errors: [];
    }
  | {
      config: null;
      warnings: string[];
      errors: string[];
    };

function flattenIssues(issues: BaseIssue<any>[]): string[] {
  return issues.map((issue) => `${getDotPath(issue)}: ${issue.message}`);
}

export function validateConfig(json: unknown, packages: Packages): ParseResult {
  // parse (...and validate)
  const writtenConfigResult = safeParse(WrittenConfigSchema, json);
  if (!writtenConfigResult.success) {
    return {
      config: null,
      warnings: [],
      errors: flattenIssues(writtenConfigResult.issues),
    };
  }
  const writtenConfig = writtenConfigResult.output;

  const packageNames = packages.packages.map((pkg) => pkg.packageJson.name);

  // normalize
  const config = normalizeWrittenConfig({
    packageNames,
    writtenConfig,
  });

  // validate
  const { errors, warnings } = validateConfigByRules({
    packages,
    packageNames,
    config,
    writtenConfig,
  });
  if (errors.length !== 0) {
    return { config: null, warnings, errors };
  }

  return { config, warnings, errors: [] };
}

export async function readConfig(
  cwd?: string,
  packages?: Packages,
): Promise<ParseResult> {
  cwd ??= process.cwd();
  packages ??= await getPackages(cwd);

  // read
  const json = JSON.parse(
    await fs.readFile(
      path.join(packages.rootDir, ".changeset", "config.json"),
      "utf8",
    ),
  );

  // parse+normalize+validate
  return validateConfig(json, packages);
}
