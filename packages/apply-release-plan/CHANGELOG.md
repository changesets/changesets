# @changesets/apply-release-plan

## 0.4.1

### Patch Changes

- Updated dependencies [[`1282ef6`](https://github.com/atlassian/changesets/commit/1282ef698761c1f634fb409842cc7de6b4d03da4)]:
  - @changesets/get-version-range-type@0.2.0

## 0.4.0

### Minor Changes

- [`fe0d9192`](https://github.com/atlassian/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3) [#236](https://github.com/atlassian/changesets/pull/236) Thanks [@Andarist](https://github.com/Andarist)! - Read also pnpm workspace packages when searching for packages.

### Patch Changes

- [`ef6402c9`](https://github.com/atlassian/changesets/commit/ef6402c9d8dc1832126732dbbafb015b71f57f83) [#252](https://github.com/atlassian/changesets/pull/252) Thanks [@Andarist](https://github.com/Andarist)! - Ensure there is a newline between release lines so the final markdown preserves correct formatting.

* [`503154db`](https://github.com/atlassian/changesets/commit/503154db39fe8ab88a1176e4569c48078bcf5569) [#257](https://github.com/atlassian/changesets/pull/257) Thanks [@Noviny](https://github.com/Noviny)! - Move catch statement so errors are less spammy

* Updated dependencies [[`fe0d9192`](https://github.com/atlassian/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3), [`fe0d9192`](https://github.com/atlassian/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3)]:
  - get-workspaces@0.6.0
  - @changesets/git@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [[`bca8865`](https://github.com/atlassian/changesets/commit/bca88652d38caa31e789c4564230ba0b49562ad2), [`bca8865`](https://github.com/atlassian/changesets/commit/bca88652d38caa31e789c4564230ba0b49562ad2)]:
  - @changesets/config@0.3.0
  - @changesets/git@0.3.0

## 0.3.0

### Minor Changes

- [`8f0a1ef`](https://github.com/atlassian/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/atlassian/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add support for prereleases. For more information, see [the docs on prereleases](https://github.com/atlassian/changesets/blob/master/docs/prereleases.md).

### Patch Changes

- Updated dependencies [[`8f0a1ef`](https://github.com/atlassian/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0)]:
  - @changesets/types@0.4.0
  - @changesets/config@0.2.3
  - get-workspaces@0.5.2
  - @changesets/git@0.2.4

## 0.2.3

### Patch Changes

- [`a679b1d`](https://github.com/atlassian/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62) [#204](https://github.com/atlassian/changesets/pull/204) Thanks [@Andarist](https://github.com/Andarist)! - Correctly handle the 'access' flag for packages

  Previously, we had access as "public" or "private", access "private" isn't valid. This was a confusing because there are three states for publishing a package:

  - `private: true` - the package will not be published to npm (worked)
  - `access: public` - the package will be publicly published to npm (even if it uses a scope) (worked)
  - `access: restricted` - the package will be published to npm, but only visible/accessible by those who are part of the scope. This technically worked, but we were passing the wrong bit of information in.

  Now, we pass the correct access options `public` or `restricted`.

- [`da11ab8`](https://github.com/atlassian/changesets/commit/da11ab8a4e4324a7023d12f990beec8c3b6ae35f) [#205](https://github.com/atlassian/changesets/pull/205) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Don't update ranges set to \*/x/X when versioning

- Updated dependencies [[`5ababa0`](https://github.com/atlassian/changesets/commit/5ababa08c8ea5ee3b4ff92253e2e752a5976cd27), [`a679b1d`](https://github.com/atlassian/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62)]:
  - @changesets/config@0.2.2
  - get-workspaces@0.5.1
  - @changesets/types@0.3.1

## 0.2.2

### Patch Changes

- [`72babcb`](https://github.com/atlassian/changesets/commit/72babcbccbdd41618d9cb90b2a8871fe63643601) [#178](https://github.com/atlassian/changesets/pull/178) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix changelog generator options not being provided

- Updated dependencies []:
  - @changesets/git@0.2.3

## 0.2.1

### Patch Changes

- [1ff73b7](https://github.com/atlassian/changesets/commit/1ff73b74f414031e49c6fd5a0f68e9974900d381) [#156](https://github.com/atlassian/changesets/pull/156) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix commits not being obtained for old changesets

* [8c43fa0](https://github.com/atlassian/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/atlassian/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

- [0320391](https://github.com/atlassian/changesets/commit/0320391699a73621d0e51ce031062a06cbdefadc) [#163](https://github.com/atlassian/changesets/pull/163) Thanks [@Noviny](https://github.com/Noviny)! - Reordered dependencies in the package json (this should have no impact)

- Updated dependencies [8c43fa0, 0320391, 1ff73b7]:
  - @changesets/get-version-range-type@0.1.1
  - @changesets/git@0.2.1
  - @changesets/types@0.3.0
  - @changesets/config@0.2.1

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/atlassian/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

### Patch Changes

- Updated dependencies [296a6731]:
  - @changesets/config@0.2.0
  - @changesets/get-version-range-type@0.1.0
  - get-workspaces@0.5.0
  - @changesets/git@0.2.0
  - @changesets/types@0.2.0

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [fded7cce](https://github.com/changesets/changesets/commit/fded7cce) - Initial release
