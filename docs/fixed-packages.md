# Fixed Packages

Fixed packages allow you to specify a group or groups of packages that should be versioned and published together.

> Unlike `linked packages`, all packages in the group of fixed packages will be version-bumped and published together even when there are no changes done to some of the the member packages.

## Examples

I have three packages, `pkg-a`, `pkg-b` and `pkg-c`. `pkg-a` and `pkg-b` are fixed but `pkg-c` is not so the config looks like this.

```json
{
  "fixed": [["pkg-a", "pkg-b"]]
}
```

- `pkg-a` is at `1.0.0`
- `pkg-b` is at `1.0.0`
- `pkg-c` is at `1.0.0`

I have a changeset with a patch for `pkg-a`, minor for `pkg-b` and major for `pkg-c` and I do a release, the resulting versions will be:

- `pkg-a` is at `1.1.0`
- `pkg-b` is at `1.1.0`
- `pkg-c` is at `2.0.0`

I now have another changeset with a minor for `pkg-a` and I do a release, the resulting versions will be:

- `pkg-a` is at `1.2.0`
- `pkg-b` is at `1.2.0`
- `pkg-c` is at `2.0.0`

## Using glob expressions

Sometimes you want to fix many or all packages within your project (for example in a monorepo setup), in which case you would need to keep the list of fixed packages up-to-date.

To make it simpler to maintain that list, you can provide glob expressions in the list that would match and resolve to all the packages that you wish to include.

For example:

```json
{
  "fixed": [["pkg-*"]]
}
```

It will match all packages starting with `pkg-`.

**The glob expressions must be defined according to the [micromatch](https://www.npmjs.com/package/micromatch) format.**
