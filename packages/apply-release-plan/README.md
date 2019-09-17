# Apply Release Plan

This takes a `releasePlan` object for changesets and applies the expected changes from that
release. This includes updating package versions, and updating changelogs.

```ts
import applyReleasePlan from "@changesets/apply-release-plan";
import { ReleasePlan, Confing } from "@changesets/types";

await applyReleasePlan(
    // The release plan to be applied - see @changesets/types for information about its shape
    aReleasePlan,
    // The directory in which applyReleasePlan should be run - mostly used for testing
    cwd: string,
    // A valid @changesets/config config - see @changesets/types for information about its shape
    config);
```

Note that `apply-release-plan` does not validate the release plan's accuracy.

To generate a releace plan from written changesets use `@changesets/get-release-plan`
