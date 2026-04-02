---
"@changesets/cli": minor
---

Respond to `--help` on all subcommands. Previously, `--help` was only handled when it was the sole argument; passing it alongside a subcommand (e.g. `changeset version --help`) would silently execute the command instead. Now `--help` always exits early and prints per-command usage when a known subcommand is provided, or the general help text otherwise.
