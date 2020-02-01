# Get Workspaces

> A simple utility to get workspaces, whether they be yarn or bolt.

This library exports a very simple function that looks at a package.json, and generates
the glob of accepted workspaces from the `workspaces` field. It is intended mostly for
use of developers building tools that want to support both kinds of mono-repos as an easy
way to write tools for both.

```javascript
import getWorkspaces from "get-workspaces";

const workspaces = await getWorkspaces();
```

Workspaces have the shape:

```
{
    name // The name from the package.json
    config // The package.json of the package
    dir // The directory of the package
}
```

## Config

We assume the function is being run from a directory with the package.json you want to target,
however you can pass in a working directory if you want. In addition, you can change what tools
the package will scan for.

```javascript
const workspaces = await getWorkspaces({ cwd, tools });
```

The tools supported are `yarn`, `bolt`, `pnpm` and `root`, which returns the root package as a single workspace if passed.
Tools is an array, so you can try for one type of workspace and then another, so you could do:

```javascript
getWorkspaces({ tools: ["bolt", "yarn", "pnpm", "root"] });
```
