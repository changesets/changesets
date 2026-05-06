# Assemble Release Plan

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/assemble-release-plan?name=true)](https://npmx.dev/package/@changesets/assemble-release-plan)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Assemble a release plan for changesets from data about a repository.

Usage

```ts
import assembleReleasePlan from "@changesets/assemble-release-plan";
import { readChangesets } from "@changesets/read";
import { read } from "@changesets/config";
import { getPackages } from "@manypkg/get-packages";
import { readPreState } from "@changesets/pre";

const packages = await getPackages(cwd);
const preState = await readPreState(cwd);
const config = await read(cwd, packages);
const changesets = await readChangesets(cwd, sinceRef);

const releasePlan = assembleReleasePlan(changesets, packages, config, preState);
```

Signature

```ts
import type {
  NewChangeset,
  Config,
  Packages,
  ReleasePlan,
} from "@changesets/types";

assembleReleasePlan = (
  changesets: NewChangeset[],
  packages: Packages,
  config: Config,
) => ReleasePlan;
```

This package exists so assembling a release plan can be done without reading from disc.
This is useful primarily for testing within the changesets project, and when you cannot
run commands within the repository you want a release plan for (some CI cases).

For most cases, you should use `@changesets/get-release-plan` which will read local changeset
files, config, and workspaces, to assemble the release plan from.
