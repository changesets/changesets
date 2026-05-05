# @changesets/parse

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/parse?name=true)](https://npmx.dev/package/@changesets/parse)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

Parses a changeset from its written format to a data object.

```js
import { parseChangesetFile } from "@changesets/parse";

const changeset = `---
"@changesets/something": minor
"@changesets/something-else": patch
---

A description of a minor change`;

const parsedChangeset = parseChangesetFile(changeset);
```

For example, it can convert:

```md
---
"@changesets/something": minor
"@changesets/something-else": patch
---

A description of a minor change
```

to

```json
{
  "summary": "A description of a minor change",
  "releases": [
    { "name": "@changesets/something", "type": "minor" },
    { "name": "@changesets/something-else", "type": "patch" }
  ]
}
```

Note that this is not quite a complete Changeset for most tools as it lacks an `id`.

For written changesets, the id is normally given as the file name, which parse is not aware of.
