# @changesets/pre

[![npm package](https://img.shields.io/npm/v/@changesets/pre)](https://npmjs.com/package/@changesets/pre)
[![View changelog](https://img.shields.io/badge/Explore%20Changelog-brightgreen)](./CHANGELOG.md)

Enter and exit pre mode in a Changesets repo.

## Usage

```ts
import { isActivePre, enterPre, exitPre } from "@changesets/pre";

console.log(`Pre Active: ${await isActivePre(cwd)}`;

await enterPre(cwd, tag);

console.log(`Pre Active: ${await isActivePre(cwd)}`;

let preState = await readPreState(cwd);

// version packages with @changesets/cli or get a release plan and apply it
await exitPre(cwd);
```

This package is used by internally by Changesets to enter and exit pre mode along with reading the pre state for the `publish` and `version` commands, you should only need it if you're using `@changesets/assemble-release-plan`, implementing Changesets or want to enter or exit pre mode programmatically.

## Types

```ts
import { PreState } from "@changesets/types";

export function isActivePre(cwd: string): Promise<boolean>;
export function enterPre(cwd: string, tag: string): Promise<void>;
export function exitPre(cwd: string): Promise<void>;
export function readPreState(cwd: string): Promise<PreState>;
```
