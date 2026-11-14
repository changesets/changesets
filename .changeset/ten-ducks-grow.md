---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
---

Now reads frontmatter metadata and passes it to changelog formatter functions:

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

```ts
export default {
  getReleaseLine: (changeset, changeType, options) => {
    // { your: "metadata here", any: "yaml", number: 123 }
    console.log(changeset.metadata);
  },
};
```
