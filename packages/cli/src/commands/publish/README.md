## Returned values from `{PM}.publish()`

- `success { stageId?: string }` (the input selects publish or stage)
- `failed` (generic error)
- `failed:already-done`
- `failed:needs-2fa { authUrl?: string; doneUrl?: string }`

## Publish Flow

1. Process the publish plan one topological chunk at a time.
2. In a TTY, publish sequentially until a non-interactive publish succeeds.
   - A provided OTP is reused while it remains valid and discarded before an interactive retry.
   - Interactive successes and `failed:already-done` continue sequentially.
3. Bulk publish the rest of the current chunk.
   - Successful and already-published packages are finished.
   - Generic failures are reported and prevent later chunks from publishing.
   - In a TTY, 2FA failures return to step 2 only when the batch has no generic failures.
   - Mixed generic and 2FA failures are reported and stop publishing.
4. In a non-TTY, start in bulk mode and report 2FA as a regular failure.
5. List the results and create git tags for successful publishes and tag-only releases in every processed chunk, including a chunk that failed.

Repeating a publish or stage is OK. Switching between them is an error.

npm uses the same stage-conflict message for already-staged and already-published
versions. We check again using the package manager's `info()`:

- Version is published -> fail.
- Version is absent -> assume it is already staged and continue.
- Lookup fails -> fail.

A version removed with `npm unpublish` also appears absent, so it can be mistaken
for an already-staged version.
