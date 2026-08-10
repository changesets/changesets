---
"@changesets/changelog-github": minor
---

Add an opt-in, experimental `template` option to render changelog lines from tokens (`{summary}`, `{ref}`, `{pull}`, `{commit}`, `{authors}`). Default output is unchanged. The token syntax may change in a patch release; pin the version if you rely on it.
