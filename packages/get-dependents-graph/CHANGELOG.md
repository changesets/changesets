# @changesets/get-dependents-graph

## 3.0.0-next.8

### Patch Changes

- Updated dependencies [[`b5e1762`](https://github.com/changesets/changesets/commit/b5e1762584718ec607ea79db0a00ae4238f8a784)]:
  - @changesets/types@7.0.0-next.8

## 3.0.0-next.7

### Patch Changes

- [#2160](https://github.com/changesets/changesets/pull/2160) [`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640) Thanks [@beeequeue](https://github.com/beeequeue)! - Added or modified the `files` property in the manifest. This should not change any behavior.
- Updated dependencies [[`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640)]:
  - @changesets/types@7.0.0-next.7

## 3.0.0-next.6

### Patch Changes

- Updated dependencies [[`4c26f2f`](https://github.com/changesets/changesets/commit/4c26f2faac89b53d3305cf73c9e9cfca5aa88f5f), [`813bbf3`](https://github.com/changesets/changesets/commit/813bbf314d051bfee3b46a793f94b396ef2a4df1)]:
  - @changesets/types@7.0.0-next.6

## 3.0.0-next.5

### Patch Changes

- Updated dependencies [[`88f2abb`](https://github.com/changesets/changesets/commit/88f2abb5e14748b08e3441fd871df60dd1c4737f)]:
  - @changesets/types@7.0.0-next.5

## 3.0.0-next.4

### Patch Changes

- [#2004](https://github.com/changesets/changesets/pull/2004) [`169b128`](https://github.com/changesets/changesets/commit/169b128522f0e53ef228f3acd8118709b0f72156) Thanks [@ghostdevv](https://github.com/ghostdevv)! - Replace `picocolors` with `node:util`'s `styleText`

- Updated dependencies [[`062530b`](https://github.com/changesets/changesets/commit/062530b825d53abc9d8934f3a50cc61ff3ff82b8)]:
  - @changesets/types@7.0.0-next.4

## 3.0.0-next.3

### Major Changes

- [#1954](https://github.com/changesets/changesets/pull/1954) [`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069) Thanks [@beeequeue](https://github.com/beeequeue)! - Bumped supported Node versions to `^22.11 || ^24 || >=26`

### Minor Changes

- [#1969](https://github.com/changesets/changesets/pull/1969) [`2c7c043`](https://github.com/changesets/changesets/commit/2c7c043d7071440009f8a69eff0b0c6746ac7625) Thanks [@marcalexiei](https://github.com/marcalexiei)! - Add a named export that mirrors the current `default` export

  The `default` export is slated for removal in the next major release, so this ensures a smoother transition path.

### Patch Changes

- Updated dependencies [[`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069), [`a0b5326`](https://github.com/changesets/changesets/commit/a0b5326570e8e7bf5e35c1cefe8f70d9a51a5cd7)]:
  - @changesets/types@7.0.0-next.3

## 3.0.0-next.2

### Major Changes

- [#1655](https://github.com/changesets/changesets/pull/1655) [`db46911`](https://github.com/changesets/changesets/commit/db46911e57603f20a158a47bbbebd112272c84e2) Thanks [@bluwy](https://github.com/bluwy)! - Update `@manypkg/get-packages` which drops support for detecting packages in Bolt monorepos and adds support for npm monorepos

### Patch Changes

- Updated dependencies [[`c19b112`](https://github.com/changesets/changesets/commit/c19b1123d27986da0e14e99d65b0f9a408def35c)]:
  - @changesets/types@7.0.0-next.2

## 2.1.4

### Patch Changes

- [#1888](https://github.com/changesets/changesets/pull/1888) [`036fdd4`](https://github.com/changesets/changesets/commit/036fdd451367226d0f2cd8af1e0a7f37a65e3464) Thanks [@mixelburg](https://github.com/mixelburg)! - Fix dependency graph validation for workspace path references. Valid `workspace:packages/pkg` specifiers are now treated as local dependencies instead of being rejected as invalid ranges.

## 3.0.0-next.1

### Major Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

### Patch Changes

- Updated dependencies [[`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d)]:
  - @changesets/types@7.0.0-next.1

## 3.0.0-next.0

### Major Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

### Patch Changes

- Updated dependencies [[`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5), [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7)]:
  - @changesets/types@7.0.0-next.0

## 2.1.3

### Patch Changes

- Updated dependencies [[`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf)]:
  - @changesets/types@6.1.0

## 2.1.2

### Patch Changes

- [#1417](https://github.com/changesets/changesets/pull/1417) [`bc75c1a`](https://github.com/changesets/changesets/commit/bc75c1a74c2d46e08620c7aa0e9f4f5ef40a9b55) Thanks [@trivikr](https://github.com/trivikr)! - Replace `chalk` with `picocolors` to reduce install size

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

## 2.1.1

### Patch Changes

- [#1400](https://github.com/changesets/changesets/pull/1400) [`dd6e5bb`](https://github.com/changesets/changesets/commit/dd6e5bbf74e246d7a742aa50424989462679b0ca) Thanks [@Andarist](https://github.com/Andarist)! - Fixed a crash in `getDependentsGraph` in a scenario when a workspace depends on the root workspace

## 2.1.0

### Minor Changes

- [#1370](https://github.com/changesets/changesets/pull/1370) [`5e9d33a`](https://github.com/changesets/changesets/commit/5e9d33a2e659abdcf26f204a76a9465cf4b26d6b) Thanks [@Andarist](https://github.com/Andarist)! - Added a new `ignoreDevDependencies` option

## 2.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/types@6.0.0

## 1.3.6

### Patch Changes

- [#1176](https://github.com/changesets/changesets/pull/1176) [`41988ce`](https://github.com/changesets/changesets/commit/41988ceb8c1cedd3857c939448bf3965494ff0a4) Thanks [@joshwooding](https://github.com/joshwooding)! - Bump [`semver`](https://github.com/npm/node-semver) dependency to v7.5.3

## 1.3.5

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1

## 1.3.4

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0

## 1.3.3

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0

## 1.3.2

### Patch Changes

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0

## 1.3.1

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0

## 1.3.0

### Minor Changes

- [#704](https://github.com/changesets/changesets/pull/704) [`6f9c9d6`](https://github.com/changesets/changesets/commit/6f9c9d60c0e02c79d555c48deb01559057f1d252) Thanks [@Andarist](https://github.com/Andarist)! - Dependencies specified using a tag will no longer mark the graph as invalid. With such dependencies the user's intent is to fetch those from the registry even if otherwise they could be linked locally.

## 1.2.4

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/types@4.0.2

## 1.2.3

### Patch Changes

- [#585](https://github.com/changesets/changesets/pull/585) [`74dda8c`](https://github.com/changesets/changesets/commit/74dda8c0d8bd1741ca7b19f0ccb37b2330dc9549) Thanks [@javier-garcia-meteologica](https://github.com/javier-garcia-meteologica)! - Add support for `workspace:^` and `workspace:~` dependency ranges.

## 1.2.2

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1

## 1.2.1

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0

## 1.2.0

### Minor Changes

- [`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101) [#507](https://github.com/changesets/changesets/pull/507) Thanks [@zkochan](https://github.com/zkochan)! - New setting added: bumpVersionsWithWorkspaceProtocolOnly. When it is set to `true`, versions are bumped in `dependencies`, only if those versions are prefixed by the workspace protocol. For instance, `"foo": "workspace:^1.0.0"`.

### Patch Changes

- Updated dependencies [[`12f9a43`](https://github.com/changesets/changesets/commit/12f9a433a6c3ac38f9405fcd77c9108c423d7101)]:
  - @changesets/types@3.3.0

## 1.1.3

### Patch Changes

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0

## 1.1.2

### Patch Changes

- [`d678da5`](https://github.com/changesets/changesets/commit/d678da5e9936862bb66e5edb538c5b8be23d4ffe) [#324](https://github.com/changesets/changesets/pull/324) Thanks [@zkochan](https://github.com/zkochan)! - Dev dependencies that are installed via the link or file protocol are ignored.

## 1.1.1

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/types@2.0.1

## 1.1.0

### Minor Changes

- [`c3cc232`](https://github.com/changesets/changesets/commit/c3cc23204c6cb80487aced1b37ebe8ffde0e2111) [#311](https://github.com/changesets/changesets/pull/311) Thanks [@zkochan](https://github.com/zkochan)! - Added support for workspace ranges. Package graph validation understands them now and allows them to satisfy dependents' required ranges.

### Patch Changes

- Updated dependencies [[`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/types@2.0.0

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3) [#306](https://github.com/changesets/changesets/pull/306) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

- Updated dependencies [[`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c), [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1)]:
  - @changesets/types@1.0.1

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Initial release of `@changesets/get-dependents-graph`. If you're migrating from `get-dependents-graph`, you will need to pass the `Packages` object(which is returned from `@manypkg/get-packages`) to `getDependentsGraph` and also import `getDependentsGraph` as a named export instead of a default export.

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf)]:
  - @changesets/types@1.0.0
