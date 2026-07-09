## Returned values from `{PM}.publish()`

- `published`
- `published:interactive`
- `skipped:already-published`
- `failed` (generic error)
- `failed:needs-token` (missing, expired, unpriveleged)
- `failed:needs-2fa { authUrl?: string; doneUrl?: string }`

## Publish Flow

1. If non-TTY or user passed an OTP code, immediately go to step 4.
2. Publish packages one-by-one, non-interactively.
   1. `published` | `skipped:*` -> go to step 4.
   2. `published:interactively` -> go to step 2, next package
   3. `failed:needs-2fa` (`authUrl`) -> handle 2fa flow inline
   4. `failed:needs-2fa` (no `authUrl`) -> retry 2. with interactive mode
   5. `failed*` -> exit 1, print error
3. Bulk publish the rest of the packages, chunked using topological sorting.
   1. Just return any result to the top level.
4. List the results of 3, telling the user to run publish again if any potentially temporary errors occurred.
