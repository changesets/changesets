import { format } from "node:util";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "@changesets/cli/package.json" with { type: "json" };
import c from "@changesets/color";
import { ExitError, InternalError } from "@changesets/errors";
import { intro, log, outro, updateSettings } from "@clack/prompts";
import { cli } from "./cli.ts";

updateSettings({ withGuide: false });

try {
  cli.parse(process.argv, { run: false });

  const commandName = cli.matchedCommand?.name;

  // Enable clack guide for interactive commands
  if (
    process.stdin.isTTY &&
    (commandName === "add" || commandName === "publish")
  ) {
    updateSettings({ withGuide: true });
  }
  // Show intro when running a command, except for --help and --version (has no command name)
  if (commandName != null) {
    intro(`🦋 changeset v${manifest.version}`);
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
