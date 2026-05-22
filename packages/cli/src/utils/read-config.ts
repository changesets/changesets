import c from "@changesets/color";
import { readConfig as originalReadConfig } from "@changesets/config";
import { ExitError } from "@changesets/errors";
import type { Config, Packages } from "@changesets/types";
import { log } from "@clack/prompts";

export async function readConfig(packages: Packages): Promise<Config> {
  const { config, warnings, errors } = await originalReadConfig(
    packages.rootDir,
    packages,
  );

  const messages: string[] = [];

  for (const warning of warnings) {
    messages.push(c.yellow(warning));
  }
  for (const error of errors) {
    messages.push(c.red(error));
  }

  const logFn = errors.length === 0 ? log.error : log.warn;
  if (messages.length !== 0) {
    logFn(`- ${messages.join("\n- ")}`);
  }

  if (errors.length !== 0) {
    throw new ExitError(1, { cause: new Error(messages.join("\n")) });
  }

  return config!;
}
