# Changesets Dictionary

This is a list of some words and phrases that are used in changesets which are helpful to know so that contributors to changesets have a shared understanding of various concepts in the project.

- **changeset** - an intent to release a set of packages at particular bump types with a summary of the changes made. For the purposes of this library, a changeset has a defined shape, as presented in [the spec](./spec.md)
- **workspace** - a local package in a multi-package repo
- **bump-type** - The type of change expected. Of type `major | minor | patch`, based on the change types of [semver](https://semver.org/ )
- **range-type** - The type of range a package depends on, such as `1.0.0`, `~1.0.0`, or `^1.0.0`. This is a subset of valid semver ranges as [defined by node](https://github.com/npm/node-semver#ranges), narrowing to ranges we can update programmatically.
- **bump** - update versions of all packages, based on the information in the current changesets
- **single-package repo** - A repository which only contains a single package which is at the root of the repo
- **multi-package repo/monorepo** - A repository which contains multiple packages, generally managed by [Bolt](https://github.com/boltpkg/bolt) or [Yarn Workspaces](https://yarnpkg.com/lang/en/docs/workspaces/).
- **release line generators** - The `getReleaseLine` and `getDependencyReleaseLine` functions which are responsible for creating the lines inserted into changelog. A changelog entry for a particular release can be thought of as `releaseLineGenerators(changesets)`

## Things that we haven't figured out how to explain well yet

- The fact that a package is depending on a package and what the range of the dependency is specified in the list of the package's dependencies. This is specifically not about the dependency but about the relationship between the dependent and the dependency.
