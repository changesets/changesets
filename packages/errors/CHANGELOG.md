# @changesets/errors

## 1.0.0-next.1

### Minor Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

## 1.0.0-next.0

### Major Changes

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

### Minor Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

## 0.2.0

### Minor Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

## 0.1.4

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

## 0.1.3

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

## 0.1.2

### Patch Changes

- [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/changesets/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `InternalError` for errors which are unexpected and if they occur, an issue should be opened. The CLI catches the error and logs a link for users to open an issue with the error and versions of Node and Changesets filled in

- [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/changesets/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `PreExitButNotInPreModeError` and `PreEnterButInPreModeError`

## 0.1.1

### Patch Changes

- [`5ababa0`](https://github.com/changesets/changesets/commit/5ababa08c8ea5ee3b4ff92253e2e752a5976cd27) [#201](https://github.com/changesets/changesets/pull/201) Thanks [@ajaymathur](https://github.com/ajaymathur)! - - Added ExitError class and ValidationError class
  - Extend extendable-error in our error classes instead of JS Error class due to better Error messages thrown

## 0.1.0

### Minor Changes

- [`94de7c1`](https://github.com/changesets/changesets/commit/94de7c1df278d63f98b599c08271ba4ef26bc3f8) [#173](https://github.com/changesets/changesets/pull/173) Thanks [@ajaymathur](https://github.com/ajaymathur)! - Create package with `GitError`
