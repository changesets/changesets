---
"@changesets/cli": patch
---

Route package manager calls through their respective CLIs during publish (npm, pnpm, yarn). Notably, Yarn Berry publishes now let Yarn update workspace protocol ranges as part of the publish process.
