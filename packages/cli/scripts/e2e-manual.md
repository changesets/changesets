# Manual publish e2e

From the repository root, run:

```sh
pnpm --filter @changesets/cli e2e:manual
```

Choose a package manager and an OTP mode, then keep this terminal open. OTP can
be disabled, required for every publish, or required only once per pnpr server
session. The accepted OTP is `123321`.

The command creates a temporary nine-package workspace and starts its
authenticated pnpr registry.

In another terminal, use the printed directory and publish command, for example:

```sh
cd "/path/printed/by/the/setup"
pnpm changeset publish
```

The packages publish in three dependency-ordered chunks. Every publish request
is delayed by three seconds at the proxy so the chunking is easy to observe.

Press Ctrl-C in the first terminal to stop pnpr. The workspace is preserved;
restart its registry with the generated `pnpr` package script (`pnpm pnpr`,
`npm run pnpr`, or `yarn pnpr`). Delete the temporary directory when finished.
