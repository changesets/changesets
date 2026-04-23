import type { Config } from "@changesets/types";
import {
  type ArgValues,
  type Command,
  type CommandContextExtension,
  createCommandContext,
  type ExtractArgs,
} from "gunshi";
import { configPlugin, packagesPlugin } from "./context.ts";

type TextContextOptions<C extends Command> = {
  cwd: string;
  command: C;
  values?: C extends Command<infer G> ? ArgValues<ExtractArgs<G>> : never;
  /** Pass a config object to the command context, or `true` to read the config file from the working directory */
  config?: Config | true;
};

export const runCommand = async <C extends Command>({
  cwd,
  command,
  values,
  config,
}: TextContextOptions<C>) => {
  if (command.run == null) {
    throw new Error(
      "Tried to test a command with `runCommand` without a `run` method",
    );
  }

  const extensions: Record<string, CommandContextExtension> = {
    packages: packagesPlugin.extension,
  };

  if (config === true) {
    extensions.config = configPlugin.extension;
  } else if (config != null) {
    extensions.config = {
      key: Symbol.for("config"),
      factory: () => config,
    };
  }

  const ctx = await createCommandContext({
    command,
    values,
    extensions,
    cliOptions: { cwd },
  });

  return command.run(ctx);
};
