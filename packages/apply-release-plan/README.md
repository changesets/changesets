# Apply Release Plan

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/@changesets/apply-release-plan?name=true)](https://npmx.dev/package/@changesets/apply-release-plan)
[![View changelog](https://npmx.dev/api/registry/badge/version/@changesets/cli?color=229fe4&value=View+changelog&label=+)](./CHANGELOG.md)

This takes a `releasePlan` object for changesets and applies the expected changes from that
release. This includes updating package versions, and updating changelogs.

```ts
import applyReleasePlan from "@changesets/apply-release-plan";
import type { ReleasePlan, Config, Packages } from "@changesets/types";

await applyReleasePlan(
    // The release plan to be applied - see @changesets/types for information about its shape
    releasePlan: ReleasePlan,

    // All information about to the repository packages - see @changesets/types for information about its shape
    packages: Packages,

    // A valid @changesets/config config - see @changesets/types for information about its shape
    config: Config
);
```

Note that `apply-release-plan` does not validate the release plan's accuracy.

To generate a release plan from written changesets use `@changesets/get-release-plan`
