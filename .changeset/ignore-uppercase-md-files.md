---
"@changesets/read": patch
---

Uppercase `.md` files in the `.changeset/` directory (such as `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`) are now silently ignored, matching the existing behavior for `README.md`. This allows keeping documentation or AI agent instructions inside `.changeset/` without causing parse errors.
