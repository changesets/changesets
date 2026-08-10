# @changesets/parse

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/parse?name=true)](https://npmx.dev/package/@changesets/parse)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Parse a changeset from its written format to a data object.

## Usage

```ts
import { parseChangesetFile } from "@changesets/parse";

const changeset = `---
"pkg-a": minor
"pkg-b": patch
---

A summary of the change`;

const parsedChangeset = parseChangesetFile(changeset);
// {
//   "summary": "A summary of the change",
//   "releases": [
//     { "name": "pkg-a", "type": "minor" },
//     { "name": "pkg-b", "type": "patch" }
//   ]
// }
```

Note that this does not include the changeset id, but it is normally given as the file name, which parse is not aware of.
