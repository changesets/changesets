---
"@changesets/changelog-github": minor
---

Added support for info overrides via changesets' frontmatter:

```markdown
---
test: minor
_:
  pr: 1337
  author: somone-else
  commit: abcdefgh
---

Changed some stuff, please update!
```
