---
"@changesets/secret-global-release": "bulbasaur"
---

### Named Releases

Have you ever sat down to upgrade all packages from a monorepo, only to find you don't know all the individual versions? Or have you ever wished for all the packages you could reference a single changelog-like file? We have, so we are adding to changesets the ability to add a global changeset. This feature works alongside something such as [linked packages](https://github.com/atlassian/changesets/blob/master/docs/linked-packages.md), but approaches the problem in a different Adding a global changeset does two things:

1. When you `version` your packages, you will also get a `RELEASE_NOTES.md` at the root of your repository (you can change the filename - see below)
2. When you run `publish` it will `dist-tag` all the published packages, so consumers can consume using the new tag name.

This allows you to name a release, that gives a unifying quality across packages, while allowing each package to keep their own separate semver numbers.

For more information on using global changesets, check out the [handy dandy global changeset docs](https://github.com/atlassian/changesets/blob/master/docs/global-changesets.md)

### Added customisation of the changelog file name

We're personally pretty happy with our `CHANGELOG.md` files, alongside our new `RELEASE_NOTES.md` for our global release notes, but not everyone likes these file names. Now you can customise it!

To add custom file names go to your `.changeset/config.json` and udpate the `changelogs` field.

The new format is:

```json
{
  "changelogs": {
    // this is where your old options should go.
    "generator": [string, any],
    // change this away from the default to pick your new location to write your changelogs.
    "filename": "CHANGELOG.md",
    // If you plan on taking advantage of named releases, you can specify where the global changelog should be written.
    "globalFilename": "RELEASE_NOTES.md"
  }
}
```

### For individual changelogs, check out [changelogs.xyz](https://changelogs.xyz/)

We wanted to make finding individual changelogs a bit easier, as it's a bit hard on npm at the moment.

[changelogs.xyz](https://changelogs.xyz/) uses algolia search, or just good old url hacking to view changelogs for any package on npm, along with markdown parsing and semver filtering. We're hoping this makes all these changelogs we're generating easier to find and consume. 😁
