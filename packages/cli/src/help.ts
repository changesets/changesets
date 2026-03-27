export const COMMAND_HELP: Record<string, string> = {
  init: "init",
  add: "add [--empty] [--open] [--since <branch>] [--message <text>] [--package <name>...] [--all] [--type <patch|minor|major>]",
  changed: "changed [--since <branch>] [--json]",
  version:
    "version [--ignore] [--snapshot <?name>] [--snapshot-prerelease-template <template>]",
  publish: "publish [--tag <name>] [--otp <code>] [--no-git-tag]",
  status: "status [--since <branch>] [--verbose] [--output JSON_FILE.json]",
  pre: "pre <enter|exit> <tag>",
  tag: "tag",
};
