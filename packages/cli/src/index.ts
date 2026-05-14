import { format } from "node:util";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "@changesets/cli/package.json" with { type: "json" };
import c from "@changesets/color";
import { ExitError, InternalError } from "@changesets/errors";
import { intro, log, outro } from "@clack/prompts";
import { cac } from "cac";
import type { AddOptions } from "./commands/add/index.ts";
import type { InitOptions } from "./commands/init/index.ts";
import type { PreOptions } from "./commands/pre/index.ts";
import type { PublishOptions } from "./commands/publish/index.ts";
import type { StatusOptions } from "./commands/status/index.ts";
import type { TagOptions } from "./commands/tag/index.ts";
import type { VersionOptions } from "./commands/version/index.ts";

const cli = cac("changeset");

cli.help();
cli.version(manifest.version);

cli.command("init").action(async (options: InitOptions) => {
  const { init } = await import("./commands/init/index.ts");
  await init(options);
});

cli
  .command("", "Add a new changeset")
  .alias("add")
  .option("--empty", "Add an empty changeset")
  .option("--open", "Open the changeset in the editor after creating it")
  .option(
    "--since <branch>",
    "Detect changed packages since the provided git ref",
  )
  .option("-m, --message <text>", "Directly provide a message to the changeset")
  .action(async (options: AddOptions) => {
    const { add } = await import("./commands/add/index.ts");
    await add(options);
  });

cli
  .command("version", "Version packages and create changelogs")
  .option("--ignore", "Packages to ignore")
  .option("--snapshot [name]", "Create a snapshot prerelease")
  .option(
    "--snapshot-prerelease-template <template>",
    "Template for snapshot prerelease",
  )
  .action(async (options: VersionOptions) => {
    const { version } = await import("./commands/version/index.ts");
    await version(options);
  });

cli
  .command("publish", "Publish packages to npm")
  .option("--otp <code>", "One time password for npm publish")
  .option("--tag <name>", "Publish with the given npm dist-tag")
  .option("--git-tag", "Create a git tag for the release")
  .action(async (options: PublishOptions) => {
    const { publish } = await import("./commands/publish/index.ts");
    await publish(options);
  });

cli
  .command("status", "Show the status of changesets")
  .option("--since <branch>", "Show changesets since the provided git ref")
  .option("-v, --verbose", "Show more information about the changesets")
  .option("-o, --output <file>", "Output the status as JSON to a file")
  .action(async (options: StatusOptions) => {
    const { status } = await import("./commands/status/index.ts");
    await status(options);
  });

cli.command("tag", "Tag release").action(async (options: TagOptions) => {
  const { tag } = await import("./commands/tag/index.ts");
  await tag(options);
});

cli
  .command("pre <enter|exit> <tag>")
  .action(
    async (
      command: "enter" | "exit",
      tag: string | undefined,
      options: PreOptions,
    ) => {
      if (command === "enter" && typeof tag !== "string") {
        log.error(`A tag must be passed when using prerelease enter`);
        throw new ExitError(1);
      }

      const { pre } = await import("./commands/pre/index.ts");
      await pre(options);
    },
  );

intro("🦋");

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (err: any) {
  if (err instanceof InternalError) {
    log.error(
      `
The following error is an internal unexpected error, these should never happen.
Please open an issue with the following link:
https://github.com/changesets/changesets/issues/new?title=${encodeURIComponent(`Unexpected error during ${cli.matchedCommandName || "add"} command`)}&body=${encodeURIComponent(`## Error

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
