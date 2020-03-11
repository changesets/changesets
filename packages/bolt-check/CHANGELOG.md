# bolt-check

## 0.4.7

### Patch Changes

- Updated dependencies [[`d08c3b3`](https://github.com/atlassian/changesets/commit/d08c3b309d38090ce4f1b8f62cc6b78a5a04efcf)]:
  - @changesets/get-version-range-type@0.3.0

## 0.4.6

### Patch Changes

- Updated dependencies [[`1282ef6`](https://github.com/atlassian/changesets/commit/1282ef698761c1f634fb409842cc7de6b4d03da4)]:
  - @changesets/get-version-range-type@0.2.0

## 0.4.5

### Patch Changes

- Updated dependencies [[`fe0d9192`](https://github.com/atlassian/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3), [`fe0d9192`](https://github.com/atlassian/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3)]:
  - get-workspaces@0.6.0

## 0.4.4

### Patch Changes

- [0320391](https://github.com/atlassian/changesets/commit/0320391699a73621d0e51ce031062a06cbdefadc) [#163](https://github.com/atlassian/changesets/pull/163) Thanks [@Noviny](https://github.com/Noviny)! - Reordered dependencies in the package json (this should have no impact)

- Updated dependencies [8c43fa0]:
  - @changesets/get-version-range-type@0.1.1

## 0.4.3

### Patch Changes

- [ca8ff585](https://github.com/atlassian/changesets/commit/ca8ff585) [#147](https://github.com/atlassian/changesets/pull/147) Thanks [@Noviny](https://github.com/Noviny)! - Use `@changesets/get-version-range-type` to get version range type, to avoid having this function duplicated

- Updated dependencies [296a6731]:
  - @changesets/get-version-range-type@0.1.0
  - get-workspaces@0.5.0

## 0.4.2

### Patch Changes

- [c46e9ee7](https://github.com/changesets/changesets/commit/c46e9ee7) - Use 'spawndamnit' package for all new process spawning

## 0.4.1

### Patch Changes

- [6d1b196f](https://github.com/changesets/changesets/commit/6d1b196f) - Add cli entrypoint to published files so the cli isn't broken

## 0.4.0

### Minor Changes

- [23ee7d64](https://github.com/changesets/changesets/commit/23ee7d64) [#108](https://github.com/changesets/changesets/pull/108) Thanks [@Blasz](https://github.com/Blasz)! - Add javascript API for bolt-check. The API currently contains check and fix commands.

- Updated dependencies [cbb2c953]:
  - get-workspaces@0.4.0

## 0.3.0

### Minor Changes

- [3d2f023f](https://github.com/changesets/changesets/commit/3d2f023f) [#77](https://github.com/changesets/changesets/pull/77) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Stop checking peerDependencies because peerDependencies are very different to dependencies and devDependencies. They generally need different ranges than what dependencies and devDependencies have and they also don't affect what version of a dependency is installed. bolt and bolt-check already only check the devDep version if there's a package that is a devDep and peerDep (and similar for other cases) so this doesn't affect checking, only auto fixing.
- [f71188cd](https://github.com/changesets/changesets/commit/f71188cd) [#74](https://github.com/changesets/changesets/pull/74) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add check banning devDependencies in root package.jsons

### Patch Changes

- [20da7747](https://github.com/changesets/changesets/commit/20da7747) [#66](https://github.com/changesets/changesets/pull/66) Thanks [@Noviny](https://github.com/Noviny)! - Update package.json field so each links into its own package

## 0.2.0

### Minor Changes

- [df63e9c0](https://github.com/changesets/changesets/commit/df63e9c0) [#64](https://github.com/changesets/changesets/pulls/64) Thanks [@Noviny](https://github.com/Noviny)! - Add '--fix' command - a very useful new feature

## 0.1.0

### Minor Changes

- [a966701d](https://github.com/Noviny/changesets/commit/a966701d) - Initial Release