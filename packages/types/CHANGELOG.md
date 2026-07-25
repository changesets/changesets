# @changesets/types

## 7.0.0-next.8

### Patch Changes

- [#2177](https://github.com/changesets/changesets/pull/2177) [`b5e1762`](https://github.com/changesets/changesets/commit/b5e1762584718ec607ea79db0a00ae4238f8a784) Thanks [@Andarist](https://github.com/Andarist)! - Allow `oldVersion` and `newVersion` to be undefined for unversioned private packages.

## 7.0.0-next.7

### Patch Changes

- [#2160](https://github.com/changesets/changesets/pull/2160) [`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640) Thanks [@beeequeue](https://github.com/beeequeue)! - Added or modified the `files` property in the manifest. This should not change any behavior.

## 7.0.0-next.6

### Major Changes

- [#2133](https://github.com/changesets/changesets/pull/2133) [`4c26f2f`](https://github.com/changesets/changesets/commit/4c26f2faac89b53d3305cf73c9e9cfca5aa88f5f) Thanks [@bluwy](https://github.com/bluwy)! - Remove `"private"` type support for `WrittenConfig.access`. Only `"public"` and `"restricted"` are valid values. This change was also already made in [#2015](https://github.com/changesets/changesets/pull/2015) in the runtime.

- [#2117](https://github.com/changesets/changesets/pull/2117) [`813bbf3`](https://github.com/changesets/changesets/commit/813bbf314d051bfee3b46a793f94b396ef2a4df1) Thanks [@bluwy](https://github.com/bluwy)! - Remove the `pre.json` `initialVersions` property and handling as it's unused internally

## 7.0.0-next.5

### Major Changes

- [#2040](https://github.com/changesets/changesets/pull/2040) [`88f2abb`](https://github.com/changesets/changesets/commit/88f2abb5e14748b08e3441fd871df60dd1c4737f) Thanks [@bluwy](https://github.com/bluwy)! - Use stricter types for the options parameter for `CommitFunctions`, `ChangelogFunctions`, `Config` & `WrittenConfig`'s `commit` and `changelog` properties, to `null | Record<string, unknown>` instead of `any` or `Record<string, any>`

## 7.0.0-next.4

### Major Changes

- [#1994](https://github.com/changesets/changesets/pull/1994) [`062530b`](https://github.com/changesets/changesets/commit/062530b825d53abc9d8934f3a50cc61ff3ff82b8) Thanks [@bluwy](https://github.com/bluwy)! - Replaced the `prettier` config option with `format`. `format` supports `"auto"`, `"prettier"`, `"oxfmt"`, `"deno"`, `"dprint"`, and `false`. If you previously used `prettier: false`, migrate to `format: false`.

## 7.0.0-next.3

### Major Changes

- [#1954](https://github.com/changesets/changesets/pull/1954) [`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069) Thanks [@beeequeue](https://github.com/beeequeue)! - Bumped supported Node versions to `^22.11 || ^24 || >=26`

- [#1652](https://github.com/changesets/changesets/pull/1652) [`a0b5326`](https://github.com/changesets/changesets/commit/a0b5326570e8e7bf5e35c1cefe8f70d9a51a5cd7) Thanks [@bluwy](https://github.com/bluwy)! - Remove support for the deprecated `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.useCalculatedVersionForSnapshots` config. The `snapshot.useCalculatedVersion` config should be used instead.

## 7.0.0-next.2

### Minor Changes

- [#1872](https://github.com/changesets/changesets/pull/1872) [`c19b112`](https://github.com/changesets/changesets/commit/c19b1123d27986da0e14e99d65b0f9a408def35c) Thanks [@marcalexiei](https://github.com/marcalexiei)! - Export `Package` and `Packages` from `@changesets/types`. They are meant to be used instead of the types from `@manypkg/get-packages`.

## 7.0.0-next.1

### Major Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

## 7.0.0-next.0

### Major Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

## 6.1.0

### Minor Changes

- [#1453](https://github.com/changesets/changesets/pull/1453) [`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf) Thanks [@bennypowers](https://github.com/bennypowers)! - Added a new config option to opt-out from formatting with Prettier using `prettier: false`.

## 6.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

## 5.2.1

### Patch Changes

- [#1033](https://github.com/changesets/changesets/pull/1033) [`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2) Thanks [@Andarist](https://github.com/Andarist)! - Added `changedFilePatterns` property to `Config` and `WrittenConfig` types.

## 5.2.0

### Minor Changes

- [#662](https://github.com/changesets/changesets/pull/662) [`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14) Thanks [@JakeGinnivan](https://github.com/JakeGinnivan)! - Added support for the `privatePackages` property in the config.

## 5.1.0

### Minor Changes

- [#858](https://github.com/changesets/changesets/pull/858) [`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e) Thanks [@dotansimha](https://github.com/dotansimha)! - Added a new config option: `snapshot.prereleaseTemplate` for customizing the way snapshot release numbers are being composed.

## 5.0.0

### Major Changes

- [#768](https://github.com/changesets/changesets/pull/768) [`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c) Thanks [@rohit-gohri](https://github.com/rohit-gohri)! - `commit` properties of config types were adjusted to account for this option potentially pointing to a module path.

## 4.1.0

### Minor Changes

- [#690](https://github.com/changesets/changesets/pull/690) [`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15) Thanks [@Andarist](https://github.com/Andarist)! - Add the new `fixed` property to the `Config` type.

## 4.0.2

### Patch Changes

- [#668](https://github.com/changesets/changesets/pull/668) [`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96) Thanks [@marcodejongh](https://github.com/marcodejongh)! - Add `resolutions` to the `PackageJSON` type.

## 4.0.1

### Patch Changes

- [#582](https://github.com/changesets/changesets/pull/582) [`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee) Thanks [@Andarist](https://github.com/Andarist)! - Add support for publishConfig.registry

## 4.0.0

### Major Changes

- [#542](https://github.com/changesets/changesets/pull/542) [`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612) Thanks [@Andarist](https://github.com/Andarist)! - A new `updateInternalDependents` experimental option has been added. It can be used to add dependent packages to the release (if they are not already a part of it) with patch bumps. To use it you can add this to your config:

  ```json
  {
    "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
      "updateInternalDependents": "always"
    }
  }
  ```

  This option accepts two values - `"always"` and `"out-of-range"` (the latter matches the current default behavior).

## 3.3.0

### Minor Changes

- [`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101) [#507](https://github.com/changesets/changesets/pull/507) Thanks [@zkochan](https://github.com/zkochan)! - New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.

## 3.2.0

### Minor Changes

- [`f4973a2`](https://github.com/changesets/changesets/commit/f4973a25ec6a837f36d64c1fb4b108ace3bc1f9d) [#467](https://github.com/changesets/changesets/pull/467) Thanks [@Andarist](https://github.com/Andarist)! - Exported a new `Linked` type for convenience - it's an alias for `ReadonlyArray<ReadonlyArray<string>>`.`

## 3.1.1

### Patch Changes

- [`a57d163`](https://github.com/changesets/changesets/commit/a57d16355ad7d67b18b768c8f79224d80afa507c) [#428](https://github.com/changesets/changesets/pull/428) Thanks [@dotansimha](https://github.com/dotansimha)! - Updated signature of `PackageJSON['publishConfig']` to include `directory?: string`.

## 3.1.0

### Minor Changes

- [`9dcc364`](https://github.com/changesets/changesets/commit/9dcc364bf19e48f8f2824ebaf967d9ef41b6fc04) [#371](https://github.com/changesets/changesets/pull/371) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Add `ignore` config option to configure ignored packages. The versions of ignored packages will not be bumped during a release, but their dependencies will still be bumped normally.

### Patch Changes

- [`addd725`](https://github.com/changesets/changesets/commit/addd7256d9251d999251a7c16c0a0b068d557b5d) [#383](https://github.com/changesets/changesets/pull/383) Thanks [@Feiyang1](https://github.com/Feiyang1)! - Added an experimental flag `onlyUpdatePeerDependentsWhenOutOfRange`. When set to `true`, we only bump peer dependents when peerDependencies are leaving range.

## 3.0.0

### Major Changes

- [`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d) [#358](https://github.com/changesets/changesets/pull/358) Thanks [@Blasz](https://github.com/Blasz)! - Add new updateInternalDependencies config option to disable auto bumping of internal dependencies in the same release if the dependency was only patch bumped

## 2.0.1

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

## 2.0.0

### Major Changes

- [`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e) [#313](https://github.com/changesets/changesets/pull/313) Thanks [@zkochan](https://github.com/zkochan)! - Add in `none` as a potential option for bumpType in release plans. Note that this is experimental and is internal, not a possible user option

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1) [#298](https://github.com/changesets/changesets/pull/298) Thanks [@eps1lon](https://github.com/eps1lon)! - In changelog-github, throw more descriptive error when no options are provided.

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Rename `ModCompWithWorkspace` to `ModCompWithPackage` and change `config` key with `packageJson`

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Remove `Workspace` type. You should use the `Package` type from `@manypkg/get-packages` instead.

### Minor Changes

- [`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997) [#292](https://github.com/changesets/changesets/pull/292) Thanks [@acheronfail](https://github.com/acheronfail)! - Add new `Changeset` type

### Patch Changes

- [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf) [#291](https://github.com/changesets/changesets/pull/291) Thanks [@acheronfail](https://github.com/acheronfail)! - Add `baseBranch` to `Config` type

## 0.4.0

### Minor Changes

- [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0) [#183](https://github.com/changesets/changesets/pull/183) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Add `PreState` type and `preState` property to `ReleasePlan`

## 0.3.1

### Patch Changes

- [`a679b1d`](https://github.com/changesets/changesets/commit/a679b1dcdcb56652d31536e2d6326ba02a9dfe62) [#204](https://github.com/changesets/changesets/pull/204) Thanks [@Andarist](https://github.com/Andarist)! - Correctly handle the 'access' flag for packages

  Previously, we had access as "public" or "private", access "private" isn't valid. This was a confusing because there are three states for publishing a package:
  - `private: true` - the package will not be published to npm (worked)
  - `access: public` - the package will be publicly published to npm (even if it uses a scope) (worked)
  - `access: restricted` - the package will be published to npm, but only visible/accessible by those who are part of the scope. This technically worked, but we were passing the wrong bit of information in.

  Now, we pass the correct access options `public` or `restricted`.

## 0.3.0

### Minor Changes

- [1ff73b7](https://github.com/changesets/changesets/commit/1ff73b74f414031e49c6fd5a0f68e9974900d381) [#156](https://github.com/changesets/changesets/pull/156) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Remove `Changeset` type because it isn't used and make commit optional on NewChangesetWithCommit because the commit won't always exist

### Patch Changes

- [8c43fa0](https://github.com/changesets/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/changesets/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/changesets/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [6d119893](https://github.com/changesets/changesets/commit/6d119893) - Initial Release
- [519b4218](https://github.com/changesets/changesets/commit/519b4218) - Add WrittenConfig type and include all properties in Config type
