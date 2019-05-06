Change format of changelog entries

Previously changelog entries were in the form of:

```md
## 2.1.0

- [patch] Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)
- [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)
```

which doesn't take into account the importance of particular entries. We are moving to an ordered system for changelog
entries, and to match this, we are updating the headings we use to the following format:

```md
## 2.1.0

### Minor

- Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)

### Patch

- [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)
```

This changes the format of the default `getReleaseLine` from

```js
const getReleaseLine = async (changeset, versionType) => {
  const indentedSummary = changeset.summary
    .split("\n")
    .map(l => `  ${l}`.trimRight())
    .join("\n");

  return `- [${versionType}] ${changeset.commit}:\n\n${indentedSummary}`;
};
```

to

```js
// eslint-disable-next-line no-unused-vars
const getReleaseLine = async (changeset, type) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map(l => l.trimRight());

  return `- ${changeset.commit}: ${firstLine}\n${futureLines
    .map(l => `  ${l}`)
    .join("\n")}`;
};
```

You will end up with some odd changelog entries if you do not update your release line.
