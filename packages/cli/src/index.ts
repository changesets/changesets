import { createRequire } from "node:module";
import { format } from "node:util";
import { ExitError, InternalError } from "@changesets/errors";
import { intro, log, outro } from "@clack/prompts";
import { cli } from "gunshi";
import pc from "picocolors";
import { addCommand } from "./commands/add/index.ts";
// import { initCommand } from "./commands/init/index.ts";
import { preCommand } from "./commands/pre/index.ts";
// import { publishCommand } from "./commands/publish/index.ts";
// import { statusCommand } from "./commands/status/index.ts";
// import { tagCommand } from "./commands/tag/index.ts";
// import { versionCommand } from "./commands/version/index.ts";
import { configPlugin, packagesPlugin } from "./gunshi/context.ts";

const require = createRequire(import.meta.url);

await cli(
  process.argv.slice(2),
  {
    internal: true,
    examples: `
changeset
changeset init
changeset add --open
changeset version
changeset publish --otp 123456
changeset pre enter next
changeset pre exit
              `.trim(),
    toKebab: true,
  },
  {
    plugins: [packagesPlugin, configPlugin],
    renderHeader: () => Promise.resolve(""),
    name: "changeset",
    description:
      "🦋 Organise your package versioning and publishing to make both contributors and maintainers happy",
    version: require("@changesets/cli/package.json").version,
    fallbackToEntry: true,
    subCommands: {
      add: addCommand,
      // init: initCommand,
      pre: preCommand,
      // publish: publishCommand,
      // status: statusCommand,
      // tag: tagCommand,
      // version: versionCommand,
    },

    onBeforeCommand: (ctx) => {
      if (ctx.values.help) return;
      intro("🦋");
    },
    onAfterCommand: (ctx) => {
      if (ctx.values.help) return;
      outro("", { withGuide: false });
    },
    renderValidationErrors: (_, error) => {
      log.error(error.errors.join("\n"));
      outro(pc.red(`🦋 Exited with code 1`));
      process.exit(1);
    },
    onErrorCommand: (_, err) => {
      console.dir(err);
      if (err instanceof InternalError) {
        log.error(
          `
The following error is an internal unexpected error, these should never happen.
Please open an issue with the following link:
https://github.com/changesets/changesets/issues/new?title=${encodeURIComponent(`Unexpected error during ${parsed._[0] || "add"} command`)}&body=${encodeURIComponent(`## Error

\`\`\`
${format(err).replace(process.cwd().replace(/\\/g, "/"), "<cwd>")}
\`\`\`

## Versions

- @changesets/cli@${require("@changesets/cli/package.json").version}
- node@${process.version}

## Extra details

<!-- Add any extra details of what you were doing, ideas you have about what might have caused the error and reproduction steps if possible. If you have a repository we can look at that would be great. 😁 -->
`)}
      `.trim(),
        );
      }

      if (err instanceof ExitError) {
        outro(pc.red(`🦋 Exited with code ${err.code}`));
        return process.exit(err.code);
      }

      log.error(err.stack ?? err.message);
      outro(pc.red("🦋 Exited with code 1"));
      process.exit(1);
    },
  },
);
