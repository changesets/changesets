import { format } from "node:util";
// this requires that the package is built _after_ bumping versions before publishing
import manifest from "@changesets/cli/package.json" with { type: "json" };
import color from "@changesets/color";
import { ExitError, InternalError } from "@changesets/errors";
import { intro, log, outro } from "@clack/prompts";
import mri from "mri";
import { COMMAND_HELP } from "./help.ts";
import { run } from "./run.ts";

const args = process.argv.slice(2);
const aliases = {
  // Short flags
  v: "verbose",
  o: "output",
  m: "message",
  // Support kebab-case flags
  "git-tag": "gitTag",
  "snapshot-prerelease-template": "snapshotPrereleaseTemplate",
};

const parsed = mri(args, {
  boolean: ["verbose", "empty", "open", "gitTag", "snapshot"],
  string: [
    "output",
    "otp",
    "since",
    "ignore",
    "message",
    "tag",
    "snapshot",
    "snapshotPrereleaseTemplate",
  ],
  // mri mutates the alias object passed to it, so we need to copy it here to maintain the original object
  alias: { ...aliases },
});

// `mri` doesn't handle mixed boolean and strings well. It'll always try to coerce it as
// a string even if only `--snapshot` is passed. We check here if this was the case and
// try to coerce it as a boolean
if (parsed.snapshot === "" && args[args.indexOf("--snapshot") + 1] !== "") {
  parsed.snapshot = true;
}

if (parsed.help) {
  const command = parsed._[0];
  if (command && COMMAND_HELP[command]) {
    console.log(`
  Usage
    $ changeset ${COMMAND_HELP[command]}

    `);
  } else {
    console.log(
      `
  Organise your package versioning and publishing to make both contributors and maintainers happy

  Usage
    $ changeset [command]
  Commands
${Object.values(COMMAND_HELP)
  .map((cmd) => `    ${cmd}`)
  .join("\n")}

    `,
    );
  }
  process.exit(0);
}

// Version should only be shown if it's the only argument passed
if (parsed.version && args.length === 1) {
  console.log(manifest.version);
  process.exit(0);
}

const cwd = process.cwd();
const flags = { ...parsed };
for (const flag of ["_", ...Object.keys(aliases)]) {
  delete flags[flag];
}

intro("🦋");

run(parsed._, flags, cwd).catch((err) => {
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

- @changesets/cli@${manifest.version}
- node@${process.version}

## Extra details

<!-- Add any extra details of what you were doing, ideas you have about what might have caused the error and reproduction steps if possible. If you have a repository we can look at that would be great. 😁 -->
`)}
      `.trim(),
    );
  }

  if (err instanceof ExitError) {
    outro(color.red(`🦋 Exited with code ${err.code}`));
    return process.exit(err.code);
  }

  log.error(err.stack);
  outro(color.red("🦋 Exited with code 1"));
  process.exit(1);
});
