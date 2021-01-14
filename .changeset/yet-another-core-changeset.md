---
"@changesets/cli": minor
---

Automatically deepen shallow clones in order to determine the correct commit at which changesets were added. This helps Git-based changelog generators to always link to the correct commit. From now on it's not required to configure `fetch-depth: 0` for your `actions/checkout` when using [Changesets GitHub action](https://github.com/changesets/action).
