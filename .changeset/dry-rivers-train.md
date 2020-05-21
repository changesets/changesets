---
"@changesets/apply-release-plan": minor
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
---

Add support for snapshot flag to version command. Usage: `changeset version --snapshot [tag]`. The updated version of the packages looks like `0.0.0[-tag]-YYYYMMDDHHMMSS` where YYYY, MM, DD, HH, MM, and SS is the date and time of when the snapshot version is created. You can use this feature with the tag option in the publish command to publish packages under experimental tags from feature branches. To publish a snapshot version of a package under an experimental tag you can do:

```
$ # Version packages to snapshot version
$ changeset version --snapshot
$ # Publish packages under exprimental tag, keeping next and latest tag clean
$ changeset publish --tag exprimental
```
