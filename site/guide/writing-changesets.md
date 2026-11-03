# Writing changesets

A changeset is a piece of information about changes made in a branch or commit.

We recommend the following questions as guideline:

- WHAT the change is
- WHY the change was made, if relevant to the consumer
- HOW a consumer should update their code, if they have to

Not every changeset is going to need a huge amount of detail.

```markdown
---
example: patch
---

Fixes a bug where a function didn't work properly.
```

## Major (breaking) changes

For major changes it is _highly_ recommended to include a description of how users should migrate their code.

```markdown
---
example: major
---

Renamed a bunch of functions.

To migrate, find+replace the following:

- `foobar` -> `fooBar`
- `bizbaz` -> `bizBaz`
```

## Overrides (`@changesets/changelog-github` only)

It is possible to override certain values in the changelog output via the frontmatter.

All the overrides are optional and can be used to customize the changelog output.

::: code-group

```markdown [Without overrides]
---
example: patch
---

Fixes a bug where a function didn't work properly.

vvv Produces vvv

- #7321 `nb08132` Thanks @me! - Fixes a bug where a function didn't work properly.
```

```markdown [With overrides]
---
example: patch
_:
  pr: 1337
  author: not-me
  commit: abcdefg
---

Fixes a bug where a function didn't work properly.

vvv Produces vvv

- #1337 `abcdefg` Thanks @not-me! - Fixes a bug where a function didn't work properly.
```

:::
