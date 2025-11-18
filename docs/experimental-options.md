# Experimental Options

All experimental options are configured in `config.json` under `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH` flag.

> Please use these experimental flags with caution, and please pay attention to release notes - these config flags might change in patch versions.

## `updateInternalDependents` (type: `'out-of-range' | 'always'`)

Default value: `out-of-range`.

The config flag can be used to add dependent packages to the release (if they are not already a part of it) with patch bumps.

## `onlyUpdatePeerDependentsWhenOutOfRange` (type: `boolean`)

Default value: `false`

When set to `true`, Changesets will only bump peer dependents when `peerDependencies` are leaving the range.
