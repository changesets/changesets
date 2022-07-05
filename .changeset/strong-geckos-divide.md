---
"@changesets/assemble-release-plan": minor
"@changesets/cli": minor
"@changesets/config": minor
"@changesets/types": minor
---

Added a new config option: `snapshotPreidTemplate` for customizing the way snapshot release numbers are being composed.

### Available placeholders

You can use the following placeholders for customizing the snapshot release version:

- `{tag}` - name of the tag, as specified in `--snapshot something`
- `{commit}` - the Git commit ID
- `{timestamp}` - Unix timestamp of the time of the release
- `{datetime}` - date and time of the release (14 characters, for example: `20211213000730`)

> Note: if you are using `--snapshot` with empty tag name, you cannot use `{tag}` as placeholder - this will result in error.

### Integration with `useCalculatedVersionForSnapshots`

You can still use and pass `useCalculatedVersionForSnapshots: boolean` if you wish to have the snapshot releases to based on the planned release of changesets, instead of `0.0.0`.

### Legacy mode

If you are not specifying `snapshotPreidTemplate`, the defualt behaviour will fallback to use the following template: `{tag}-{datetime}`, and in cases where tag is empty (`--snapshot` with no tag name), it will use `{datetime}` only.
