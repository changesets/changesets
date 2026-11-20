---
"@changesets/parse": minor
"@changesets/read": minor
"@changesets/types": minor
"@changesets/write": minor
---

Now supports arbitrary frontmatter metadata inside `_`:

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
