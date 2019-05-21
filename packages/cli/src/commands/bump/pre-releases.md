We are trying to come up with a valid way to do pre-releases that makes things as easy as possible for the package maintainer.

The following are notes from a discussion that have been tidied up for those not present, with some additional commentary.

One of the core things to investigate was whether information about something being a pre is something decided
at bump time, or something decided at changeset add time (store the information in a changeset).

This is trying to handle the increase in possible states a package can be in:

major, minor, patch, pre-release (with the possiblity of splitting on pre:minor, pre:major, pre:patch etc)

Note that both likely indicate creating a new command `pre-release`. This will likely follow a lot of the code
paths of `bump` or `add`, but we want this to be quite separate.

All example below assume the following packages and interdependencies in the repository:

```
pkgA@1.0.0

pkgB@1.0.0 {
pkgA: "^1.0.0"
}

pkgC@1.0.0 {
pkgD: "^1.0.0"
}

pkgD@1.0.0
```

## A detour into a hard Problem

Managing two release branches is hard, and has a lot of margin for error, particularly if one
may be merged into another. Managing two release branches in an interlinked mono-repo is a small
nightmare. You can absolutely publish a version of a package that makes part of the pre branch invalid,
but not all of it.

I fundamentally don't intend to solve this problem. If you need to reconcile between these two branches,
that's going to be for you to manually do, and ensure gets done correctly. Pre-releases will definitely try
and help, but manual checking is definitely going to be required to use this.

## run `pre-release` instead of `version`

We are working off the assumption that this follows on from: https://github.com/Noviny/changesets/issues/9

### New Problem

Existing changesets do not hold enough information to do a pre-release of all necessary
packages, while leaving the repository in a non-broken state.

This is because all pre-releases are breaking changes for child packages, and failing to
bump them creates an incompatibility with installing (bolt will fail, yarn will do bad things)

However when generating changesets, not all change types require bumping dependents.

Example, the changeset:

```
pkgA@minor
dependencies: []
```

is valid (and what we would generate), but if we only rely on existing changesets leaves you with the repository state:

```
pkgA@1.1.0-alpha.0

pkgB@1.0.0 {
pkgA: "^1.0.0"
}

pkgC@1.0.0 {
pkgD: "^1.0.0"
}

pkgD@1.0.0
```

With `b` now depending on the wrong version of `a`. Not ideal.

Immediate suggestion is for the `pre-release` command to go and find this information,
and automatically version these packages, storing that information in `.changeset/pre.json`
(name very not final). This causes problems if you go to do an actual publish.

Say in the above, we bump pkgB to `pkgB@1.0.1-alpha.0`. Moving out of pre, we now need
to make sure we publish `pkgB@1.0.1`. Further, this means if you ran one branch for `pre`
and then did your final bump from a different `pure` branch, `pkgB@1.0.1` would never
be published. This may fall into Hard Problem above though.

### Possible solution

Split `pre-release` up

`pre-release (enter)` (enter is implicitly provided)
`pre-relase update` (implicitly run update if a pre-release file already exists)
`pre-release exit`

Pre-release enter generates the `pre.json` file, and sets up all the new dependencies in it.
Pre-release update updates both `pre.json`
Pre-release exit resets all versions, and adds a new changeset for anything that needs a patch
bump.

NB: This new changeset is going to need some thought about shape etc.

If you run `bump` while there is a `pre.json`, it will error and explain itself.

BONUS: I think changesets should error if there is a package in a pre state when you run bump,
as I don't think changesets handle this gracefully.

## Adding new categories to changesets and having explicit pre changesets

This is the alternate suggestion. Effectively the version select becomes something like:

```
major
minor
patch
pre
```

... I remember Tim liked this, but I can't remember the reasoning behind it. Will dig in
further.

Original notes for posterity below

---

pkgA@1.0.0

pkgB@1.0.0 {
pkgA: "^1.0.0"
}

pkgC@1.0.0 {
pkgD: "^1.0.0"
}

pkgD@1.0.0

bump throws if pres are present
pre-release warns but continues for non-pres
leave-pre

// changeset:
pkgA@pre:minor
dependencies: [pgkB];
pkgD@patch
dependencies: [];

// pkgA@1.1.0-alpha.0

pkgA@pre
dependencies: [pgkB];

pkgA@1.1.0-alpha.1

// regular bump
pkgA@1.1.0
no other changes

// pre alpha
pkgA@1.1.0-alpha.0

// EVERY BOLT THING IS BROKEN

1. We just update everything and don't publish them?
   pkgB@1.0.0 {
   pkgA: "^1.1.0-alpha.0"
   }

pkgC@1.0.0 {
pkgA: "^1.1.0-alpha.0"
}

PROBLEMS

1. During an actual release from this (leaving pre) - pkgB and pkgC will not be updated at all - probably not desired dep?
2. Local changes not reflected by NPM

3. Bump them now
   pkgB@1.0.1-alpha.0 {
   pkgA: "^1.1.0-alpha.0"
   }

pkgC@1.0.1-alpha.0 {
pkgA: "^1.1.0-alpha.0"
}

PROBLEMS

1. Things not in changesets are getting bumped
   - We would need to track what all these are, to tidy up on actual release
   - On actual release, what gets released?

// > s.satisfies('1.2.0-alpha.0', '^1.1.0')

Master version updates while we are in a pre-state on a branch
breaks preleases.json original version concept :( (probably a git diff error)

---

Qualities of a Pre-Release

1. It updates the `package.json` to a new semver range
   // 2. It will often be done from a non-master branch
2. It updates its dependencies to stay in range

Fun with pre-releases

3. Doing pre-relesase may lead you to maintain multiple versions of the packages
   This was always true of maintaining updates on older versions, but we have always just said 'roll forward'
