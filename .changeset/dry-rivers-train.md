---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
---

- Add support for snapshot flag to version command. Usage: `changeset version --snapshot [tag]`. The updated version of the packages look like `0.0.0[-tag]-YYYYMMDDHHMMSS` where YYYY, MM, DD, HH, MM and SS is the date and time of when snapshot version is created. We can use this feature with combination of the tag option in publish command to publsh packages under exprimental tags from feature branches. To publish package a snapshot version of package under experimetal we can do:

```
$ # Version packages to snapshot version
$ changeset version --snapshot
$ # Publish packages under exprimental tag, keeping next and latest tag clean
$ changeset publish --tag exprimental
```

