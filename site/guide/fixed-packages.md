# Fixed Packages

Fixed packages allow you to specify a group or groups of packages that should be versioned and published together. They can be configured with the [`fixed`](./config.md#fixed) option.

::: info Compared to [linked packages](./linked-packages.md)
With fixed packages, all packages in the group will be version-bumped and published together even when there are no changes done to some of the the member packages, which means all packages will always have the same version.
:::

## Examples

### General Example

Let's say we have three packages, `pkg-a`, `pkg-b`, and `pkg-c`. `pkg-a` and `pkg-b` are fixed but `pkg-c` is not so the config looks like this:

```json [.changeset/config.json]
{
  "fixed": [["pkg-a", "pkg-b"]]
}
```

- `pkg-a` is at `1.0.0`
- `pkg-b` is at `1.0.0`
- `pkg-c` is at `1.0.0`

We have a changeset with a patch for `pkg-a`, minor for `pkg-b` and major for `pkg-c`, and we do a release, the resulting versions will be:

- `pkg-a` is at `1.1.0`
- `pkg-b` is at `1.1.0`
- `pkg-c` is at `2.0.0`

We now have another changeset with a minor for `pkg-a`, and we do a release, the resulting versions will be:

- `pkg-a` is at `1.2.0`
- `pkg-b` is at `1.2.0`
- `pkg-c` is at `2.0.0`
