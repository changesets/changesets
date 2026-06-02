// this json import requires that the package is built _after_ bumping versions before publishing
import manifest from "@changesets/cli/package.json" with { type: "json" };
import c from "@changesets/color";
import { log } from "@clack/prompts";
import { cac } from "cac";
import { ExitError } from "../../errors/src/index.ts";

export const cli = cac("changeset");

cli.version(manifest.version);
cli.help((sections) => {
  // Show nicer help message title
  sections[0] = { body: `🦋 changeset v${manifest.version}` };
});

// Simplify the version output compared to the default
cli.globalCommand.outputVersion = () => console.info(manifest.version);

function normalizeOptions(
  options: Record<string, any>,
  { array }: { array?: string[] } = {},
) {
  // Do not allow positional arguments in options
  delete options["--"];

  for (const key in options) {
    // Remove aliases
    if (options[key] == null || key.length === 1) {
      delete options[key];
      continue;
    }

    // If the flag is expected to be an array, ensure it's an array.
    if (array?.includes(key)) {
      const v = options[key];
      options[key] = Array.isArray(v) ? v.map(String) : [String(v)];
    }
    // If a flag is passed multiple times (becoming an array), only take the last value.
    else if (Array.isArray(options[key])) {
      options[key] = options[key].at(-1);
    }

    // Do not be smart and auto cast for number-only strings, keep them as strings.
    // If we need some flags as numbers in the future, add a new `number` option like `array`.
    if (typeof options[key] === "number") {
      options[key] = String(options[key]);
    }
  }
}

cli
  .command("init", "Initialize a new changesets setup")
  .action(async (options) => {
    normalizeOptions(options);
    const { init } = await import("./commands/init/index.ts");
    await init(options);
  });

cli
  .command("add", "Add a new changeset (default)")
  .usage("[command] [options]")
  .example("  $ changeset -m 'Description'")
  .example("  $ changeset --open --since main")
  .alias("!") // special alias for default command
  .option("--empty", "Add an empty changeset")
  .option("--open", "Open the changeset in the editor after creating it")
  .option(
    "--since <branch>",
    "Detect changed packages since the provided git ref",
  )
  .option("-m, --message <text>", "Directly provide a message to the changeset")
  .action(async (options) => {
    normalizeOptions(options);
    const { add } = await import("./commands/add/index.ts");
    await add(options);
  });

cli
  .command("version", "Version packages and create changelogs")
  .example("  $ changeset version")
  .example("  $ changeset version --snapshot 'pr#123'")
  .option("--ignore <pkg>", "Packages to ignore")
  .option("--snapshot [name]", "Create a snapshot prerelease")
  .option(
    "--snapshot-prerelease-template <template>",
    "Template for snapshot prerelease",
  )
  .action(async (options) => {
    normalizeOptions(options, { array: ["ignore"] });
    const { version } = await import("./commands/version/index.ts");
    await version(options);
  });

cli
  .command("publish", "Publish packages to npm and create git tags")
  .example("  $ changeset publish --otp 123456")
  .example("  $ changeset publish --tag beta")
  .option("--otp <code>", "One time password for npm publish")
  .option("--tag <name>", "Publish with the given npm dist-tag")
  .option("--git-tag", "Create a git tag for the release", { default: true })
  .action(async (options) => {
    normalizeOptions(options);
    const { publish } = await import("./commands/publish/index.ts");
    await publish(options);
  });

cli
  .command("publish-plan", "Show packages that are ready to publish or tag")
  .option("-o, --output <file>", "Output the publish plan as JSON to a file")
  .action(async (options) => {
    normalizeOptions(options);
    const { publishPlan } = await import("./commands/publish-plan/index.ts");
    await publishPlan(options);
  });

cli
  .command("status", "Show the changesets that currently exist")
  .example("  $ changeset status --verbose")
  .option("--since <branch>", "Show changesets since the provided git ref")
  .option("-v, --verbose", "Show more information about the changesets")
  .option("-o, --output <file>", "Output the status as JSON to a file")
  .action(async (options) => {
    normalizeOptions(options);
    const { status } = await import("./commands/status/index.ts");
    await status(options);
  });

cli
  .command("tag", "Create git tags for the current version of all packages")
  .action(async (options) => {
    normalizeOptions(options);
    const { tag } = await import("./commands/tag/index.ts");
    await tag(options);
  });

cli
  .command(
    "pre <enter|exit> [tag]",
    "Enter or exit prerelease mode (tag required for enter)",
  )
  .action(async (command: string, tag: string | undefined, options) => {
    normalizeOptions(options);

    if (command !== "enter" && command !== "exit") {
      log.error(
        `Only ${c.cyan("enter")} or ${c.cyan("exit")} is accepted after pre`,
      );
      throw new ExitError(1);
    }

    if (command === "enter" && typeof tag !== "string") {
      log.error(`A tag must be passed when using pre enter`);
      throw new ExitError(1);
    }

    const { pre } = await import("./commands/pre/index.ts");
    await pre({ ...options, command, tag });
  });
