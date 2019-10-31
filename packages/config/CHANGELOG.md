# @changesets/config

## 0.2.2

### Patch Changes

- [`5ababa0`](https://github.com/atlassian/changesets/commit/5ababa08c8ea5ee3b4ff92253e2e752a5976cd27) [#201](https://github.com/atlassian/changesets/pull/201) Thanks [@ajaymathur](https://github.com/ajaymathur)! - Updated to use the Error classes from the @changesets/errors package

* [`a679b1d`](https://github.com/atlassian/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62) [#204](https://github.com/atlassian/changesets/pull/204) Thanks [@Andarist](https://github.com/Andarist)! - Correctly handle the 'access' flag for packages

  Previously, we had access as "public" or "private", access "private" isn't valid. This was a confusing because there are three states for publishing a package:

  - `private: true` - the package will not be published to npm (worked)
  - `access: public` - the package will be publicly published to npm (even if it uses a scope) (worked)
  - `access: restricted` - the package will be published to npm, but only visible/accessible by those who are part of the scope. This technically worked, but we were passing the wrong bit of information in.

  Now, we pass the correct access options `public` or `restricted`.

* Updated dependencies [[`51a0d76`](https://github.com/atlassian/changesets/commit/51a0d766c7064b4c6a9d1490593522c6fcd02929), [`a679b1d`](https://github.com/atlassian/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62), [`5ababa0`](https://github.com/atlassian/changesets/commit/5ababa08c8ea5ee3b4ff92253e2e752a5976cd27)]:
  - @changesets/logger@0.0.1
  - @changesets/types@0.3.1
  - @changesets/errors@0.1.1

## 0.2.1

### Patch Changes

- Updated dependencies [8c43fa0, 1ff73b7]:
  - @changesets/types@0.3.0

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/atlassian/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

### Patch Changes

- Updated dependencies [296a6731]:
  - @changesets/types@0.2.0

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [519b4218](https://github.com/changesets/changesets/commit/519b4218) - Initial release with parse and read functions along with defaultConfig and defaultWrittenConfig

- Updated dependencies [519b4218]:
  - @changesets/types@0.1.0
