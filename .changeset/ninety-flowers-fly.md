---
"@changesets/cli": patch
"@changesets/errors": patch
---

Add `InternalError` for errors which are unexpected and if they occur, an issue should be opened. The CLI catches the error and logs a link for users to open an issue with the error and versions of Node and Changesets filled in
