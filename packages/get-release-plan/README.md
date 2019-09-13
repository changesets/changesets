# @changesets/get-release-plan

A function that reads information about the current repository

```js
import getReleasePlan from "@changesets/get-release-plan";

const releasePLan = await getReleasePlan(cwd, sinceMaster, passedConfig);
```

## cwd: string

The directory to run `getReleasePlan` in - most often `process.cwd()`

## sinceMaster: boolean (default false)

Sets whether to use all changests present, or only those changesets that are new since the branch
diverged from master.

## passedConfig: Config

The changeset config options as defined in `@changesets/types`
