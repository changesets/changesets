---
"@changesets/parse": minor
"@changesets/read": minor
"@changesets/types": minor
---

Now reads frontmatter metadata inside `_` into the optional `metadata` key on `Changeset`:

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

```typescript
{
  id: "foo-bar-biz",
  summary: "Something changed!",
  releases: [/* ... */],
  metadata: {
    your: "metadata here",
    any: "yaml",
    number: 123,
  }
}
```
