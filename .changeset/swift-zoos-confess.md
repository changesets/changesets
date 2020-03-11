---
"@changesets/get-dependents-graph": major
---

Initial release of `@changesets/get-dependents-graph`. If you're migrating from `get-dependents-graph`, you will need to pass the `Packages` object(which is returned from `@manypkg/get-packages`) to `getDependentsGraph` and also import `getDependentsGraph` as a named export instead of a default export.
