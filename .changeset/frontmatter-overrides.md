---
"@changesets/changelog-github": minor
"@changesets/parser": minor
---

Added support for info overrides via the changesets' frontmatter:

```markdown
---
test: minor
_:
  pr: 1337
  author: somone-else
---

Changed some stuff, please update!
```

This has been supported in the changeset body text since 2021, but was undocumented before now (thanks @ematipico for letting us know!)

```markdown
---
test: minor
---

Changed some stuff, please update!

pr: 1337
author: somone-else
```
