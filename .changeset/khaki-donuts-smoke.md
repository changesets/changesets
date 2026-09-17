---
"@changesets/cli": minor
---

`changeset add` now accepts `--major`, `--minor` and `--patch` without a package list. The option then bumps the packages detected as changed, the same set the interactive prompt groups under `changed packages`, which makes the non-interactive path usable without working the list out by hand:

```sh
changeset add --patch -m 'Fix the export types'
```

Packages named explicitly keep the release type they were named with and are left out of the detected set, so `--major pkg-a --patch` majors `pkg-a` and patches everything else that changed. `--since` selects the ref the detection compares against.
