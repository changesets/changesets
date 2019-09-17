# Assemble Release Plan

Assemble a release plan for changesets from data about a repository.

Usage

```ts
import assembleReleasePlan from "@changesets/assemble-release-plan";

const releasePlan = await assembleReleasePlan(
  changesets,
  workspaces,
  dependentsGraph,
  config
);
```

Signature

```ts
import {
  NewChangeset,
  Workspace,
  Config,
  ReleasePlan
} from "@changesets/types";

assembleReleasePlan = (
  changesets: NewChangeset[],
  workspaces: Workspace[],
  dependentsGraph: Map<string, string[]>,
  config: Config
) => ReleasePlan;
```

This package exists so assembling a release plan can be done without reading from disc.
This is useful primarily for testing within the changesets project, and when you cannot
run commands within the repository you want a release plan for (some CI cases).

For most cases, you should use `@changesets/get-release-plan` which will read local changeset
files, config, and workspaces, to assemble the release plan from.
