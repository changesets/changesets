---
"@changesets/apply-release-plan": patch
---

Self-references should be skipped when bumping versions. A self-reference is a dev dep that has the same name as the package. Some projects use self-references as a convinient way to require files using relative paths from the root directory.
