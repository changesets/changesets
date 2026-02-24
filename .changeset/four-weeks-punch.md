---
"@changesets/cli": minor
---

Use root-style git tags (v1.0.0) when all packages in a monorepo belong to a single fixed group

When all packages in a workspace are configured as a single fixed group (e.g., `fixed: [["pkg-a", "pkg-b"]]` where pkg-a and pkg-b are all the packages), the CLI will now create a single root-style tag (`v1.0.0`) instead of individual package tags (`pkg-a@1.0.0`, `pkg-b@1.0.0`).

This change aligns the tagging behavior with how fixed packages are versioned - as a single unit - and matches the tag format used by single-package repositories.

**Note:** Monorepos with multiple fixed groups or mixed fixed/non-fixed packages will continue using package-style tags as before.
