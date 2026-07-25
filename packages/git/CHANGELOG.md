# @changesets/git

## 4.0.0-next.8

### Patch Changes

- [#2169](https://github.com/changesets/changesets/pull/2169) [`a736a20`](https://github.com/changesets/changesets/commit/a736a20c230a89232a122fe12ffd612361e0eef9) Thanks [@Andarist](https://github.com/Andarist)! - Preserve the caller's path spelling when resolving the Git repository root on Windows.
- Updated dependencies [[`b5e1762`](https://github.com/changesets/changesets/commit/b5e1762584718ec607ea79db0a00ae4238f8a784)]:
  - @changesets/types@7.0.0-next.8

## 4.0.0-next.7

### Patch Changes

- [#2160](https://github.com/changesets/changesets/pull/2160) [`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640) Thanks [@beeequeue](https://github.com/beeequeue)! - Added or modified the `files` property in the manifest. This should not change any behavior.
- Updated dependencies [[`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640)]:
  - @changesets/errors@1.0.0-next.4
  - @changesets/types@7.0.0-next.7

## 4.0.0-next.6

### Patch Changes

- [#584](https://github.com/changesets/changesets/pull/584) [`6c79210`](https://github.com/changesets/changesets/commit/6c79210fabfe13d82ca4ac4dc92aab9b58fd58fd) Thanks [@Andarist](https://github.com/Andarist)! - Avoid an infinite loop when git commands fail to execute when Changesets try to retrieve commits that added files.
- Updated dependencies [[`4c26f2f`](https://github.com/changesets/changesets/commit/4c26f2faac89b53d3305cf73c9e9cfca5aa88f5f), [`813bbf3`](https://github.com/changesets/changesets/commit/813bbf314d051bfee3b46a793f94b396ef2a4df1)]:
  - @changesets/types@7.0.0-next.6

## 4.0.0-next.5

### Patch Changes

- Updated dependencies [[`88f2abb`](https://github.com/changesets/changesets/commit/88f2abb5e14748b08e3441fd871df60dd1c4737f), [`6a05002`](https://github.com/changesets/changesets/commit/6a05002228a06807b1a95da841d1809ae07441bf), [`6a05002`](https://github.com/changesets/changesets/commit/6a05002228a06807b1a95da841d1809ae07441bf)]:
  - @changesets/types@7.0.0-next.5
  - @changesets/errors@1.0.0-next.3

## 4.0.0-next.4

### Patch Changes

- Updated dependencies [[`062530b`](https://github.com/changesets/changesets/commit/062530b825d53abc9d8934f3a50cc61ff3ff82b8)]:
  - @changesets/types@7.0.0-next.4

## 4.0.0-next.3

### Major Changes

- [#1954](https://github.com/changesets/changesets/pull/1954) [`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069) Thanks [@beeequeue](https://github.com/beeequeue)! - Bumped supported Node versions to `^22.11 || ^24 || >=26`

### Minor Changes

- [#1969](https://github.com/changesets/changesets/pull/1969) [`2c7c043`](https://github.com/changesets/changesets/commit/2c7c043d7071440009f8a69eff0b0c6746ac7625) Thanks [@marcalexiei](https://github.com/marcalexiei)! - Add a named export that mirrors the current `default` export

  The `default` export is slated for removal in the next major release, so this ensures a smoother transition path.

### Patch Changes

- [#1953](https://github.com/changesets/changesets/pull/1953) [`b9407b3`](https://github.com/changesets/changesets/commit/b9407b39a458bab106d0e23a3afab01d07d8482f) Thanks [@beeequeue](https://github.com/beeequeue)! - Refactored from `micromatch` to `picomatch` for globbing patterns

- Updated dependencies [[`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069), [`a0b5326`](https://github.com/changesets/changesets/commit/a0b5326570e8e7bf5e35c1cefe8f70d9a51a5cd7)]:
  - @changesets/errors@1.0.0-next.2
  - @changesets/types@7.0.0-next.3

## 4.0.0-next.2

### Major Changes

- [#1655](https://github.com/changesets/changesets/pull/1655) [`db46911`](https://github.com/changesets/changesets/commit/db46911e57603f20a158a47bbbebd112272c84e2) Thanks [@bluwy](https://github.com/bluwy)! - Update `@manypkg/get-packages` which drops support for detecting packages in Bolt monorepos and adds support for npm monorepos

### Patch Changes

- [#1875](https://github.com/changesets/changesets/pull/1875) [`12f20ea`](https://github.com/changesets/changesets/commit/12f20ea75fb5a440a378bd2bf6072a6bd749fd57) Thanks [@beeequeue](https://github.com/beeequeue)! - Replaced `spawndamnit` with `tinyexec`

- Updated dependencies [[`c19b112`](https://github.com/changesets/changesets/commit/c19b1123d27986da0e14e99d65b0f9a408def35c)]:
  - @changesets/types@7.0.0-next.2

## 4.0.0-next.1

### Major Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

### Patch Changes

- Updated dependencies [[`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d)]:
  - @changesets/errors@1.0.0-next.1

## 4.0.0-next.0

### Major Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

### Patch Changes

- [#1476](https://github.com/changesets/changesets/pull/1476) [`e0e1748`](https://github.com/changesets/changesets/commit/e0e1748369b1f936c665b62590a76a0d57d1545e) Thanks [@pralkarz](https://github.com/pralkarz)! - Replace `fs-extra` usage with `node:fs`

- [#1612](https://github.com/changesets/changesets/pull/1612) [`3628cab`](https://github.com/changesets/changesets/commit/3628cab6cbfd931b7f2a909b38b66c1aa794d4bf) Thanks [@bluwy](https://github.com/bluwy)! - Remove `is-subdir` dependency

- Updated dependencies [[`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5), [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7)]:
  - @changesets/errors@1.0.0-next.0

## 3.0.4

### Patch Changes

- [#1636](https://github.com/changesets/changesets/pull/1636) [`f73f84a`](https://github.com/changesets/changesets/commit/f73f84ac2d84d3ccf5ff55c0fc78aaaf3f3da20d) Thanks [@Netail](https://github.com/Netail)! - Correctly resolve new changesets with `since` option when the `.changeset` directory is not directly in the git root

## 3.0.3

### Patch Changes

- [#1620](https://github.com/changesets/changesets/pull/1620) [`b15e629`](https://github.com/changesets/changesets/commit/b15e6291c3e7e780ee9e58101d3069f2382569ae) Thanks [@Netail](https://github.com/Netail)! - Make sure that git diff always returns the paths relative to the git root in case diff.relative has been set to true in the git config

## 3.0.2

### Patch Changes

- [#1487](https://github.com/changesets/changesets/pull/1487) [`7323704`](https://github.com/changesets/changesets/commit/7323704dff6e76f488370db384579b86c95c866f) Thanks [@bluwy](https://github.com/bluwy)! - Bump `micromatch` dependency to ^4.0.8 to prevent installing version with vulnerability

- [#1514](https://github.com/changesets/changesets/pull/1514) [`962ab91`](https://github.com/changesets/changesets/commit/962ab918bc2deb89012a0cefce10387997cc54ed) Thanks [@nicoalonsop](https://github.com/nicoalonsop)! - Update spawndamnit to fix [cross-spawn vulnerability](https://security.snyk.io/vuln/SNYK-JS-CROSSSPAWN-8303230)

## 3.0.1

### Patch Changes

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

## 3.0.0

### Major Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/errors@0.2.0
  - @changesets/types@6.0.0

## 2.0.0

### Major Changes

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - `getCommitsThatAddFiles` accepts an options object argument now where you can use `cwd` option.

  ```diff
  -getCommitsThatAddFiles(paths, cwd);
  +getCommitsThatAddFiles(paths, { cwd });
  ```

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - `getCurrentCommitId` and `getCommitsThatAddFiles` return full commit hashes now instead of short ones. You can get short ones by using the `short: true` option.

- [#1029](https://github.com/changesets/changesets/pull/1029) [`598136a`](https://github.com/changesets/changesets/commit/598136a32a00b620c9521d7a7151fbbc721c17d7) Thanks [@Andarist](https://github.com/Andarist)! - Previously deprecated `getCommitThatAddsFile` has been removed while `getCommitsThatAddFiles` is still available.

### Minor Changes

- [#1033](https://github.com/changesets/changesets/pull/1033) [`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2) Thanks [@Andarist](https://github.com/Andarist)! - `getChangedPackagesSinceRef` accepts now a new `changedFilePatterns` option. It can be used to determine which packages should be classified as changed. You can pass an array of glob patterns to it.

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1

## 1.5.0

### Minor Changes

- [#662](https://github.com/changesets/changesets/pull/662) [`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14) Thanks [@JakeGinnivan](https://github.com/JakeGinnivan)! - Add `tagExists` & `remoteTagExists` git helpers

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0

## 1.4.1

### Patch Changes

- [#889](https://github.com/changesets/changesets/pull/889) [`f64bc1b`](https://github.com/changesets/changesets/commit/f64bc1bb33457918eae34b22f214174ba3cf4504) Thanks [@jakubmazanec](https://github.com/jakubmazanec)! - Fixed `getCurrentCommitId` so that the returned value doesn't contain quotation marks on some Windows machines.

## 1.4.0

### Minor Changes

- [#858](https://github.com/changesets/changesets/pull/858) [`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e) Thanks [@dotansimha](https://github.com/dotansimha)! - Added a new helper function: `getCurrentCommitId`

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0

## 1.3.2

### Patch Changes

- [#770](https://github.com/changesets/changesets/pull/770) [`eb86652`](https://github.com/changesets/changesets/commit/eb86652cbd21c49f90d2a03caa9a578593c4d102) Thanks [@alizeait](https://github.com/alizeait)! - `getChangedFilesSince` and `getChangedPackagesSinceRef` will now return the correct absolute paths of the changed files when the passed `cwd` is different from the repository's root.

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0

## 1.3.1

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0

## 1.3.0

### Minor Changes

- [#725](https://github.com/changesets/changesets/pull/725) [`77c1cef`](https://github.com/changesets/changesets/commit/77c1ceff402f390c1ededec358d914ba68a31d0d) Thanks [@RoystonS](https://github.com/RoystonS), [@Andarist](https://github.com/Andarist)! - New public utilities have been added: `deepenCloneBy` and `isRepoShallow`.

## 1.2.1

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/types@4.0.2

## 1.2.0

### Minor Changes

- [#634](https://github.com/changesets/changesets/pull/634) [`2b49c39`](https://github.com/changesets/changesets/commit/2b49c390a7cf24ce859ac932b432eb6d8f55c98b) Thanks [@joeldenning](https://github.com/joeldenning)! - A new `getAllTags` utility has been added.

## 1.1.2

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1

## 1.1.1

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0

## 1.1.0

### Minor Changes

- [`24d7bc9`](https://github.com/changesets/changesets/commit/24d7bc9e56a6dce7c64b39e8f73e50e21762faac) [#495](https://github.com/changesets/changesets/pull/495) Thanks [@RoystonS](https://github.com/RoystonS)! - Automatically deepen shallow clones in order to determine the correct commit at which changesets were added.

- [`24d7bc9`](https://github.com/changesets/changesets/commit/24d7bc9e56a6dce7c64b39e8f73e50e21762faac) [#495](https://github.com/changesets/changesets/pull/495) Thanks [@RoystonS](https://github.com/RoystonS)! - Deprecate the `getCommitThatAddsFile` function. It's replaced with a bulk `getCommitsThatAddFiles` operation which will safely deepen a
  shallow repo whilst processing multiple filenames simultaneously.

## 1.0.6

### Patch Changes

- [`1dd3117`](https://github.com/changesets/changesets/commit/1dd311708c65321e1a1c99d36129190f940435ed) [#418](https://github.com/changesets/changesets/pull/418) Thanks [@jonathanmorley](https://github.com/jonathanmorley)! - Don't return paths for unchanged packages

- Updated dependencies [[`a57d163`](https://github.com/changesets/changesets/commit/a57d16355ad7d67b18b768c8f79224d80afa507c)]:
  - @changesets/types@3.1.1

## 1.0.5

### Patch Changes

- [`89f0c49`](https://github.com/changesets/changesets/commit/89f0c497ac21b8d008da67caff8032947836c7b1) [#352](https://github.com/changesets/changesets/pull/352) Thanks [@MichaelKapustey](https://github.com/MichaelKapustey)! - Previously packages nested inside of other packages would show both the nested package and the outer package as changed. Now, only the nested package will show as changed.

- [`09f62f9`](https://github.com/changesets/changesets/commit/09f62f9c822f31899a48cbd93c7801d72a80b97e) [#355](https://github.com/changesets/changesets/pull/355) Thanks [@acheronfail](https://github.com/acheronfail)! - Fix an issue where refs that didn't exist were silently ignored

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0

## 1.0.4

### Patch Changes

- [`aa840db`](https://github.com/changesets/changesets/commit/aa840db824c321159e3b1c66ea663b4036084bd7) [#336](https://github.com/changesets/changesets/pull/336) Thanks [@MichaelKapustey](https://github.com/MichaelKapustey)! - Changed packages detection fixed on Windows.

## 1.0.3

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/errors@0.1.4
  - @changesets/types@2.0.1

## 1.0.2

### Patch Changes

- Updated dependencies [[`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/types@2.0.0

## 1.0.1

### Patch Changes

- [`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c) [#305](https://github.com/changesets/changesets/pull/305) Thanks [@Noviny](https://github.com/Noviny)! - Add link to changelog in readme

- [`b49e1cf`](https://github.com/changesets/changesets/commit/b49e1cff65dca7fe9e341a35aa91704aa0e51cb3) [#306](https://github.com/changesets/changesets/pull/306) Thanks [@Andarist](https://github.com/Andarist)! - Ignore `node_modules` when glob searching for packages. This fixes an issue with package cycles.

- Updated dependencies [[`04ddfd7`](https://github.com/changesets/changesets/commit/04ddfd7c3acbfb84ef9c92873fe7f9dea1f5145c), [`e56928b`](https://github.com/changesets/changesets/commit/e56928bbd6f9096def06ac37487bdbf28efec9d1)]:
  - @changesets/errors@0.1.3
  - @changesets/types@1.0.1

## 1.0.0

### Major Changes

- [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20) [#290](https://github.com/changesets/changesets/pull/290) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Use `@manypkg/get-packages` instead of `get-workspaces` in `getChangedPackagesSinceRef`. This means `getChangedPackagesSinceRef` now returns `Promise<Package[]>`(where `Package` is from `@manypkg/get-packages`) rather than `Promise<Workspace[]>`(where `Workspace` is from `get-workspaces`). The notable change is that `config` was renamed to `packageJson` and the package objects don't have a `name` field(use `packageJson.name` instead).

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf)]:
  - @changesets/types@1.0.0

## 0.4.0

### Minor Changes

- [`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3) [#236](https://github.com/changesets/changesets/pull/236) Thanks [@Andarist](https://github.com/Andarist)! - Read also pnpm workspace packages when searching for packages.

### Patch Changes

- Updated dependencies [[`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3), [`fe0d9192`](https://github.com/changesets/changesets/commit/fe0d9192544646e1a755202b87dfe850c1c200a3)]:
  - get-workspaces@0.6.0

## 0.3.0

### Minor Changes

- [`bca8865`](https://github.com/changesets/changesets/commit/bca88652d38caa31e789c4564230ba0b49562ad2) [#221](https://github.com/changesets/changesets/pull/221) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Removed `getChangedPackagesSinceMaster` and `getChangedChangesetFilesSinceMaster` and replace them with `getChangedPackagesSinceRef` and `getChangedChangesetFilesSinceRef`. The new methods along with `getChangedFilesSince` also now require arguments as an object with `cwd` and `ref` properties to avoid accidentally passing `cwd` as `ref` and vice versa

## 0.2.5

### Patch Changes

- [`b17ed74`](https://github.com/changesets/changesets/commit/b17ed7411ea57e38b20e646321d5053b213d198a) [#216](https://github.com/changesets/changesets/pull/216) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Get commit from the creation of a changeset rather than the last modification

## 0.2.4

### Patch Changes

- Updated dependencies [[`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0), [`8f0a1ef`](https://github.com/changesets/changesets/commit/8f0a1ef327563512f471677ef0ca99d30da009c0)]:
  - @changesets/types@0.4.0
  - @changesets/errors@0.1.2
  - get-workspaces@0.5.2

## 0.2.3

### Patch Changes

- Updated dependencies [[`94de7c1`](https://github.com/changesets/changesets/commit/94de7c1df278d63f98b599c08271ba4ef26bc3f8)]:
  - @changesets/errors@0.1.0

## 0.2.2

### Patch Changes

- [89c0894](https://github.com/changesets/changesets/commit/89c08944fac84f71241305e359e9717ad4ec1b62) [#167](https://github.com/changesets/changesets/pull/167) Thanks [@Noviny](https://github.com/Noviny)! - Fix broken `sinceMaster` arg - which was not working with v2 changesets

## 0.2.1

### Patch Changes

- [8c43fa0](https://github.com/changesets/changesets/commit/8c43fa061e2a5a01e4f32504ed351d261761c8dc) [#155](https://github.com/changesets/changesets/pull/155) Thanks [@Noviny](https://github.com/Noviny)! - Add Readme

- [0320391](https://github.com/changesets/changesets/commit/0320391699a73621d0e51ce031062a06cbdefadc) [#163](https://github.com/changesets/changesets/pull/163) Thanks [@Noviny](https://github.com/Noviny)! - Reordered dependencies in the package json (this should have no impact)

- Updated dependencies [8c43fa0, 1ff73b7]:
  - @changesets/types@0.3.0

## 0.2.0

### Minor Changes

- [296a6731](https://github.com/changesets/changesets/commit/296a6731) - Safety bump: Towards the end of preparing changesets v2, there was a lot of chaos - this bump is to ensure every package on npm matches what is found in the repository.

### Patch Changes

- Updated dependencies [296a6731]:
  - get-workspaces@0.5.0
  - @changesets/types@0.2.0

## 0.1.2

### Patch Changes

- [a15abbf9](https://github.com/changesets/changesets/commit/a15abbf9) - Previous release shipped unbuilt code - fixing that

## 0.1.0

### Minor Changes

- [6d119893](https://github.com/changesets/changesets/commit/6d119893) - Initial Release

### Patch Changes

- [c46e9ee7](https://github.com/changesets/changesets/commit/c46e9ee7) - Use 'spawndamnit' package for all new process spawning
