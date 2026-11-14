---
"@changesets/parse": minor
"@changesets/read": minor
---

Now reads frontmatter metadata under the `_` key into `metadata`:

```markdown
---
foo: minor
_:
  your: "metadata here"
  any: yaml
  number: 123
---

Something changed!
```
