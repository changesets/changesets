---
"@changesets/cli": minor
---

Delegate OTP prompting to the package manager instead of handling it in-process. This allows Changesets to use the package manager's native web auth support.
