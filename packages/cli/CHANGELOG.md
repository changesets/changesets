# @changesets/cli

## 1.1.0
### Minor Changes

- [6929624b](https://github.com/Noviny/changesets/commit/6929624b) [#27](https://github.com/Noviny/changesets/pulls/27) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add linked packages/lockstep

## 1.0.1

### Patch Changes

- 9435d886: Fix binary and published files

## 1.0.0

### Major Changes

- 51c8b0d6: Remove `noChangelog` flag in favor of `updateChangelog` flag (default behaviour remains the same).

  If you were using this custom flag, you will need to replaces `noChangelog: true` with `updateChangelog: false`

- 51c8b0d6: Rename commands from @atlaskit/build-releases

  We are no longer mirroring the names from npm/yarn commands, so it is easy to write package scripts
  for each command without footguns. The functionality of the commands remains the same. In addition,
  the binary has been changed to `changeset`.

  The new names are:

  - `build-releases initialize` => `changeset init` (for ecosystem consistency)
  - `build-releases changeset` => `changeset` (default command). You can also run `changeset add`
  - `build-releases version` => `changeset bump`
  - `build-releases publish` => `changeset release`

  The function of these commands remains unchanged.

  - 51c8b0d6: Change format of changelog entries

  Previously changelog entries were in the form of:

  ```md
  ## 2.1.0

  - [patch] Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)
  - [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)
  ```

  which doesn't take into account the importance of particular entries. We are moving to an ordered system for changelog
  entries, and to match this, we are updating the headings we use to the following format:

  ```md
  ## 2.1.0

  ### Minor

  - Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)

  ### Patch

  - [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)
  ```

  This changes the format of the default `getReleaseLine` from

  ```js
  const getReleaseLine = async (changeset, versionType) => {
    const indentedSummary = changeset.summary
      .split("\n")
      .map(l => `  ${l}`.trimRight())
      .join("\n");

    return `- [${versionType}] ${changeset.commit}:\n\n${indentedSummary}`;
  };
  ```

  to

  ```js
  const getReleaseLine = async (changeset, type) => {
    const [firstLine, ...futureLines] = changeset.summary
      .split("\n")
      .map(l => l.trimRight());

    return `- ${changeset.commit}: ${firstLine}\n${futureLines
      .map(l => `  ${l}`)
      .join("\n")}`;
  };
  ```

  You will end up with some odd changelog entries if you do not update your release line.

### Minor Changes

- 51c8b0d6: Support non-bolt repositories

  Changesets have been expanded to support:

  - bolt repositories
  - yarn workspaces-based repositories
  - single package repositories.

  Currently **not** supported: bolt repositories with nested workspaces.

  To do this, functions that call out to bolt have been inlined, and obviously marked
  within the file-system. In addition, the `get-workspaces` function has undergone
  significant change, and will be extracted out into its own package soon.

  This is to support other tools wanting this level of inter-operability.

  If plans to modularize bolt proceed, we may go back to relying on its functions.

  This should have no impact on use.

  - 51c8b0d6: Add 'select all' and 'select all changed' options, to make mass-bumping easier.
  - eeb4d5c6: Add new command: `status` - see Readme for more information

# @atlaskit/build-releases - legacy changelog

## 3.0.3

- [patch][c87337f](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/c87337f):

  - The version command now removes empty folders before it starts. This should prevent a race condition in CI

## 3.0.2

- [patch][f7b030a](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f7b030a):

  - Fixes potential infinite loop in parseChangesetCommit

## 3.0.1

- [patch][494c1fe](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/494c1fe):

  - Update git commit message to match previous tooling.

## 3.0.0

- [major][44ec8bf" d](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/44ec8bf"
  d):

  Changesets now use local file system - this has several effects:

  1. Changesets will no longer automatically create a commit. You will need to add and commit the files yourself.
  2. Changesets are easier to modify. You should ONLY modify the changes.md file (_Not changes.json_).
  3. There will be a new directory which is `.changeset`, which will hold all the changesets.

  Apart from these changes, your process using this should not have changed.

  Changeset now accepts skipCI flag, where previously release commits automatically skipped CI. i.e.

  ```
  yarn build-releases version --skipCI
  ```

  **Breaking**: Changeset and version commands now accept `--commit` flag which makes them commit automatically (previously this was the default behaviour). Otherwise, these commands simply make the file-system changes.

  ```
  yarn build-releases changeset --commit
  ```

  We also introduce the `intitialize` command. See the package [README.md](https://www.npmjs.com/package/@atlaskit/build-releases) for more details about this.

## 2.1.3

- [patch] Bumps bolt version to get some bug fixes around publishing [493f5f7](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/493f5f7)

## 2.1.2

- [patch] Pulls in fix in bolt causing publishing to fail when running a yarn subprocess (see boltpkg/bolt #189) [2b36121](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/2b36121)

## 2.1.1

- [patch] Fixes bug where empty summaries would cause a changeset to not get found [25b30bf](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/25b30bf)

## 2.1.0

- [minor] Allows passing --public flag for publishing scoped packages [159c28e](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/159c28e)
- [minor] Changes changelogs to be opt out rather than opt in [f461788](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/f461788)

## 2.0.0

- [major] Completely refactors build-releases to be externally consumable 8458ef7](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/8458ef7)

## 1.28.2

- [patch] Bug fix and better error messages for changeset error [7f09b86](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/7f09b86)

## 1.28.1

- [patch] update flow dep, fix flow errors [722ad83](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/722ad83)

## 1.28.0

- [minor] Adds tagging to releases [34c64fd](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/34c64fd)

## 1.27.0

- [minor] Splits out and exposes flattenChangesets function [5ee5f74](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/5ee5f74)

## 1.26.0

- [minor] Lots of new features (consider this package unstable and only for use internally) [7cdf2e6](https://bitbucket.org/atlassian/atlaskit-mk-2/commits/7cdf2e6)
