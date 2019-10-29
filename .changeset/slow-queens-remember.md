---
"@changesets/cli": minor
---

Respect `publishConfig.access` in workspace package.jsons

Previously, every package in your repository had one 'public' or 'restricted' setting.

Now, if a workspace has `publishConfig.access` in its package.json, we will prioritize it over the global changesets config.
