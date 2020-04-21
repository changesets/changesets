---
"@changesets/types": major
"@changesets/apply-release-plan": major
---

We have updated the type of resolved Config (the old written config is still valid). This changes what `applyReleasePlan` accepts.

Previously the changeset resolved config type was:

```ts
type oldType = false | [string, any];
```

The new type is:

```ts
type newType =
  | false
  | {
      generator: [string, any];
      filename: string;
      globalFilename: string;
    };
```

This new object has the old information under the key `generator` - which is for the changelog generation functions. There are also two new options.

`filename` - this option will change where we write changelogs for packages to. The default remains `CHANGELOG.md`

`globalFilename` - as part of supporting our new global changeset feature, we can now write a global (repo-wide) changelog. We are defaulting this to `RELEASE_NOTES.md` to be written at the root, but this config option allows you to change that as you wish.

This also changes the function signature of `apply-release-plan` as it needs the new resolved config. As long as you update `@changesets/parse` - it should continue to work.
