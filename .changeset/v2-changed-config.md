---
"@changesets/cli": major
---

#### Changed how Config works

The Changesets config is now written in JSON with fewer options. The new defaults are shown below.

```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [],
  "access": "private"
}
```

**Reasoning**: Having a JSON config makes it easier to build other tools on changesets because the config can be read without executing user code that could potentially be unsafe. It also means we can have easy autocompletion and descriptions in editors that don't go out of date like the comments in the JS config along with being able to packagise changelog entry generators.

##### Migrating

1. Run `yarn changeset init` to create a config file in the new format at `.changeset/config.json`
1. If you're using changelogs, move `getReleaseLine` and `getDependencyReleaseLine` to their own module and set the changelog option to the path to the module. If you're not using changelogs, set the changelog option to `false`. In the future, we will be providing packages to write changelogs for common use cases
1. Set `access` to `"public"` if `publishOptions.public` is `true`, otherwise set it to `"private"`
1. If you use `linked`, copy your linked package groups from the JS config to the the JSON file
1. If you use `commit` and `skipCI` in `versionOptions` or `publishOptions`, set commit to `true`, all commits will include a skip ci message. if you have a use case for only using commit on one command or not including a skip ci message by default
1. Delete `.changeset/config.js`
