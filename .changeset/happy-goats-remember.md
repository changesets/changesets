---
"@changesets/cli": patch
---

From now on, to fix issues with some auto-save configurations in IDEs, the editor won't be re-opened if one saves an empty summary. In such a scenario the CLI will prompt again for the summary to be written in the terminal.
