---
"@changesets/cli": patch
---

Improved `changeset publish` auth handling by removing the preflight OTP requirement check and falling back to interactive auth when the package manager reports that authentication is required.
