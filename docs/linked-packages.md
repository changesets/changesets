# Linked Packages

Linked packages allow you to specify a group or groups of packages that should be versioned together. There are some complex cases, so some examples are shown below to demonstrate various cases.

- Linked packages will still only bumped when there is a changeset for them (this can mean because you explicitly choose to add a changeset for it or because it's a dependant of something being released)
- Packages that have changesets and are in a set of linked packages will **always** be versioned to the highest current version in the set of linked packages + the highest bump type from changesets in the set of linked packages

## Examples

### General example

I have three packages, `pkg-a`, `pkg-b` and `pkg-c`. `pkg-a` and `pkg-b` are linked but `pkg-c` is not so the config looks like this.

```json
{
  "linked": [["pkg-a", "pkg-b"]]
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
- `pkg-b` is at `1.1.0`
- `pkg-c` is at `2.0.0`

I now have another changeset with a minor for `pkg-b` and I do a release, the resulting versions will be:

- `pkg-a` is at `1.2.0`
- `pkg-b` is at `1.3.0`
- `pkg-c` is at `2.0.0`

I now have another changeset with patches for all three packages and I do a release, the resulting versions will be:

- `pkg-a` is at `1.3.1`
- `pkg-b` is at `1.3.1`
- `pkg-c` is at `2.0.1`

### Example with dependants

I have two packages, `pkg-a`, `pkg-b` which are linked. `pkg-a` has a dependency on `pkg-b`.

```json
{
  "linked": [["pkg-a", "pkg-b"]]
}
```

- `pkg-a` is at `1.0.0`
- `pkg-b` is at `1.0.0`

I have a changeset with a major for `pkg-b` and I do a release, the resulting versions will be:

- `pkg-a` is at `2.0.0`
- `pkg-b` is at `2.0.0`

I now have another changeset with a major for `pkg-a` and I do a release, the resulting versions will be:

- `pkg-a` is at `3.0.0`
- `pkg-b` is at `2.0.0`
