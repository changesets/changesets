# get-workspaces

## 0.5.0

### Minor Changes

- [296a6731](https://github.com/atlassian/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

## 0.4.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.4.0

### Minor Changes

- [cbb2c953](https://github.com/changesets/changesets/commit/cbb2c953) [#89](https://github.com/changesets/changesets/pull/89) Thanks [@highvoltag3](https://github.com/highvoltag3)! - Making sure the arrays are sorted before using them

### Patch Changes

- [d4bbab4e](https://github.com/changesets/changesets/commit/d4bbab4e) [#91](https://github.com/changesets/changesets/pull/91) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add PackageJSON type
- [94267ff3](https://github.com/changesets/changesets/commit/94267ff3) [#106](https://github.com/changesets/changesets/pull/106) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add private property to PackageJSON type

## 0.3.1

### Patch Changes

- [20da7747](https://github.com/changesets/changesets/commit/20da7747) [#66](https://github.com/changesets/changesets/pull/66) Thanks [@Noviny](https://github.com/Noviny)! - Update package.json field so each links into its own package

## 0.3.0

### Minor Changes

- [83ba6d3f](https://github.com/Noviny/changesets/commit/83ba6d3f) - Export Workspace type

### Patch Changes

- [a966701d](https://github.com/Noviny/changesets/commit/a966701d) - Add repository information to package.json

## 0.2.1

### Patch Changes

- [67db935d](https://github.com/Noviny/changesets/commit/67db935d) - Fix release without built files

## 0.2.0

### Minor Changes

- [355b4d00](https://github.com/Noviny/changesets/commit/355b4d00) [#41](https://github.com/Noviny/changesets/pulls/41) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Throw when the name field is missing in a package.json

### Patch Changes

- [c6f1c7b7](https://github.com/Noviny/changesets/commit/c6f1c7b7) [#46](https://github.com/Noviny/changesets/pulls/46) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Distribute TypeScript types
- [355b4d00](https://github.com/Noviny/changesets/commit/355b4d00) [#41](https://github.com/Noviny/changesets/pulls/41) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Convert package to TypeScript

## 0.1.1

### Patch Changes

- [bed96aa2](https://github.com/Noviny/changesets/commit/bed96aa2) [#35](https://github.com/Noviny/changesets/pulls/35) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Use workspaces.packages instead of the incorrect workspaces.package field for resolving yarn workspaces

## 0.1.0

### Minor Changes

- [b93d04a2](https://github.com/Noviny/changesets/commit/b93d04a2) - Initial release of get-workspaces
