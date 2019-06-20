# Changesets Dictionary

This is a list of some words and phrases that are used in changesets which are helpful to know so that contributors to changesets have a shared understanding of various concepts in the project.

Several of these have associated type definitions, which you can find in [our types package](./packages/types)

- **changeset** - an intent to release a set of packages at particular bump types with a summary of the changes made. Changesets are stackable, that is running `bump` will apply any number of changesets correctly. Changesets are used to generate further information, such as the `release information`, and the `release plan`.
- **summary** - Information about the changes the changeset represents - this is written out to the `CHANGELOG.md` file of every package mentioned in the changeset.
- **changeset folder** - A `./changeset` folder - this is where we store written versions of changesets. Currently we assume all changesets are written to this.
- **workspace** - a local package in a multi-package repo
- **bump-type** - The type of change expected. Of type `major | minor | patch | none`, based on the change types of [semver](https://semver.org/)
- **range-type** - The type of range a package depends on, such as `1.0.0`, `~1.0.0`, or `^1.0.0`. This is a subset of valid semver ranges as [defined by node](https://github.com/npm/node-semver#ranges), narrowing to ranges we can update programmatically.
- **bump**
  - (1) The command to apply all current changesets and update all package versions and changelogs.
  - (2) The act of updating a package version to a new version.
- **single-package repo** - A repository which only contains a single package which is at the root of the repo
- **multi-package repo/monorepo** - A repository which contains multiple packages, generally managed by [Bolt](https://github.com/boltpkg/bolt) or [Yarn Workspaces](https://yarnpkg.com/lang/en/docs/workspaces/).
- **release line generators** - The `getReleaseLine` and `getDependencyReleaseLine` functions which are responsible for creating the lines inserted into changelog. A changelog entry for a particular release can be thought of as `releaseLineGenerators(changesets)`
- **linked packages** - Linked packages share a semver categorisation, such that all published linked packages have consistent new semver ranges. The logistics of this are best left to our [./linked-packages.md] documentation.
- **release instruction** An object containing an intent to release a single package, consisting of the package name and a bump type
- **release plan** - A calculated object that shows everything a collection of changesets will release, and at what version, and how. This object includes a calculation of dependencies, and considerations for `linked` packages.

## Things that we haven't figured out how to explain well yet

- The fact that a package is depending on a package and what the range of the dependency is specified in the list of the package's dependencies. This is specifically not about the dependency but about the relationship between the dependent and the dependency.
