# @changesets/pre

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/pre?name=true)](https://npmx.dev/package/@changesets/pre)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Enter and exit pre mode in a Changesets repo.

## Usage

```ts
import { enterPre, exitPre } from "@changesets/pre";

await enterPre(cwd, tag);

let preState = await readPreState(cwd);

// version packages with @changesets/cli or get a release plan and apply it
await exitPre(cwd);
```

This package is used by internally by Changesets to enter and exit pre mode along with reading the pre state for the `publish` and `version` commands, you should only need it if you're using `@changesets/assemble-release-plan`, implementing Changesets or want to enter or exit pre mode programmatically.

## Types

```ts
import type { PreState } from "@changesets/types";

export function enterPre(cwd: string, tag: string): Promise<void>;
export function exitPre(cwd: string): Promise<void>;
export function readPreState(cwd: string): Promise<PreState>;
```
