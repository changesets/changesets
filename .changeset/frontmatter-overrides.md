---
"@changesets/changelog-github": minor
"@changesets/parser": minor
---

Added support for info overrides via changesets' frontmatter:

```markdown
---
test: minor
_:
  pr: 1337
  author: somone-else
---

Changed some stuff, please update!
```
