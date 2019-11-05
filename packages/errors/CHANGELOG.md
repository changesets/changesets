# @changesets/errors

## 0.1.2

### Patch Changes

- [`8f0a1ef`](https://github.com/atlassian/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/atlassian/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `InternalError` for errors which are unexpected and if they occur, an issue should be opened. The CLI catches the error and logs a link for users to open an issue with the error and versions of Node and Changesets filled in

* [`8f0a1ef`](https://github.com/atlassian/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/atlassian/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `PreExitButNotInPreModeError` and `PreEnterButInPreModeError`

## 0.1.1

### Patch Changes

- [`5ababa0`](https://github.com/atlassian/changesets/commit/5ababa08c8ea5ee3b4ff92253e2e752a5976cd27) [#201](https://github.com/atlassian/changesets/pull/201) Thanks [@ajaymathur](https://github.com/ajaymathur)! - - Added ExitError class and ValidationError class
  - Extend extendable-error in our error classes instead of JS Error class due to better Error messages thrown

## 0.1.0

### Minor Changes

- [`94de7c1`](https://github.com/atlassian/changesets/commit/94de7c1df278d63f98b599c08271ba4ef26bc3f8) [#173](https://github.com/atlassian/changesets/pull/173) Thanks [@ajaymathur](https://github.com/ajaymathur)! - Create package with `GitError`
