---
"@changesets/cli": minor
---

Respect `access: public` in workspace package.jsons`

Previously, every package in your repository had one 'public' or 'restricted' setting.

Now, if a workspace lists `access` in its package.json, we will defer to the workspace configuration over the global changesets config.
