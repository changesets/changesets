## Stop depending on bolt.

Currently there are 13 places where we call bolt functions.

- getWorkspaces x 5
- getDependentsGraph x 1
- getProject x 1
- updatePackageVersions x 1
- publishPackages x 1

updatePackageVersions is the one that is most heavily tied to bolt internals. The rest are easy enough to abstract out.

NEW TOPIC

## We probably want changelog entries to look like this:

```md
## 2.1.0

### Minor

- Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)

### Patch

- [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)
```
