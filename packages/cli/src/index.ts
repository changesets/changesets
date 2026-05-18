import { format } from "node:util";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "@changesets/cli/package.json" with { type: "json" };
import c from "@changesets/color";
import { ExitError, InternalError } from "@changesets/errors";
import { intro, log, outro, updateSettings } from "@clack/prompts";
import { cac } from "cac";

updateSettings({ withGuide: false });

const cli = cac("changeset");

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
  options["--"] = undefined;

  for (const key in options) {
    if (options[key] == null) continue;

    // If the flag is expected to be an array, ensure it's an array.
    if (array?.includes(key)) {
      const v = options[key];
      options[key] = Array.isArray(v) ? v : [v];
      continue;
    }

    // If a flag is passed multiple times (becoming an array), only take the last value.
    if (Array.isArray(options[key])) {
      options[key] = options[key].at(-1);
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
  .example("changeset -m 'Added a new feature'")
  .example("changeset add --open --since main")
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
  .example("changeset version")
  .example("changeset version --snapshot 'pr#123'")
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
  .example("changeset status --otp 123456")
  .example("changeset status --tag beta")
  .option("--otp <code>", "One time password for npm publish")
  .option("--tag <name>", "Publish with the given npm dist-tag")
  .option("--git-tag", "Create a git tag for the release")
  .action(async (options) => {
    normalizeOptions(options);
    const { publish } = await import("./commands/publish/index.ts");
    await publish(options);
  });

cli
  .command("status", "Show the changesets that currently exist")
  .example("changeset status --verbose")
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
  .command("pre enter <tag>", "Enter prerelease mode with the given tag")
  .action(async (tag: string, options) => {
    normalizeOptions(options);
    const { pre } = await import("./commands/pre/index.ts");
    await pre({ ...options, command: "enter", tag });
  });

cli.command("pre exit", "Exit prerelease mode").action(async (options) => {
  normalizeOptions(options);
  const { pre } = await import("./commands/pre/index.ts");
  await pre({ ...options, command: "exit" });
});

try {
  cli.parse(process.argv, { run: false });

  // Do not show intro for --help and --version, which have no command name
  if (cli.matchedCommand?.name != null) {
    intro(`🦋 changeset v${manifest.version}\n`);
  }

  await cli.runMatchedCommand();
} catch (err: any) {
  if (err instanceof InternalError) {
    log.error(
      `
The following error is an internal unexpected error, these should never happen.
Please open an issue with the following link:
https://github.com/changesets/changesets/issues/new?title=${encodeURIComponent(`Unexpected error during ${cli.matchedCommand?.name || "add"} command`)}&body=${encodeURIComponent(`## Error

\`\`\`
${format(err).replace(process.cwd().replace(/\\/g, "/"), "<cwd>")}
\`\`\`

## Versions

- @changesets/cli@${manifest.version}
- node@${process.version}

## Extra details

<!-- Add any extra details of what you were doing, ideas you have about what might have caused the error and reproduction steps if possible. If you have a repository we can look at that would be great. 😁 -->
`)}
      `.trim(),
    );
  }

  if (err instanceof ExitError) {
    outro(c.red(`🦋 Exited with code ${err.code}`));
    process.exit(err.code);
  }

  log.error(err.stack);
  outro(c.red("🦋 Exited with code 1"));
  process.exit(1);
}
