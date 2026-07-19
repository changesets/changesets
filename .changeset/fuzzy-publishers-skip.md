---
"@changesets/cli": patch
---

Improve publish error handling for npm and pnpm JSON errors. Changesets now skips npm 11 already-published errors that omit `code`, correctly skips pnpm 11 already-published errors, and retries pnpm 11 `ERR_PNPM_OTP_NON_INTERACTIVE` publish failures in delegated interactive mode.
