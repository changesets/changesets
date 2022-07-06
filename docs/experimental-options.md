# Experimental Options

All experimental options are configured in `config.json` under `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH` flag. 

> Please use these experimental flags with caution, and please pay attention to release notes - these config flags might change in patch versions. 

## `updateInternalDependents` (type: `'out-of-range' | 'always'`)

Default value: `out-of-range`.

The config flag can be used to add dependent packages to the release (if they are not already a part of it) with patch bumps.

## `onlyUpdatePeerDependentsWhenOutOfRange` (type: `boolean`)

Default value: `false`

When set to `true`, Changesets will only bump peer dependents when `peerDependencies` are leaving the range.

## `useCalculatedVersionForSnapshots` (type: `boolean`) 

Default value: `false`

When `changesets version --snapshot` is used, the default behavior is to use `0.0.0` as the base version for the snapshot release. 

Setting `useCalculatedVersionForSnapshots: true` will change the default behavior and will the planned version, based on the changesets files.

## `snapshotPreidTemplate` (type: `string | undefined`)

Default value: `undefined` (see note below)

Configures the suffix for the snapshot releases, using a template with placeholders.

### Available placeholders

You can use the following placeholders for customizing the snapshot release version:

- `{tag}` - the name of the snapshot tag, as specified in `--snapshot something`
- `{commit}` - the Git commit ID
- `{timestamp}` - Unix timestamp of the time of the release
- `{datetime}` - date and time of the release (14 characters, for example, `20211213000730`)

> Note: if you are using `--snapshot` with empty tag name, you cannot use `{tag}` as placeholder - this will result in error.

### Integration with `useCalculatedVersionForSnapshots`

You can still use and pass `useCalculatedVersionForSnapshots: boolean` if you wish to have the snapshot releases based on the planned release of changesets, instead of `0.0.0`.

### Default behavior

If you are not specifying `snapshotPreidTemplate`, the default behavior will fall back to using the following template: `{tag}-{datetime}`, and in cases where the tag is empty (`--snapshot` with no tag name), it will use `{datetime}` only.
