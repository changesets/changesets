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
