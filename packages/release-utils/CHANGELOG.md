# @changesets/release-utils

## 1.0.0-next.1

### Minor Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

### Patch Changes

- Updated dependencies [[`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d)]:
  - @changesets/types@7.0.0-next.1
  - @changesets/read@1.0.0-next.1
  - @changesets/pre@3.0.0-next.1

## 1.0.0-next.0

### Major Changes

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

### Minor Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

- [#1618](https://github.com/changesets/changesets/pull/1618) [`e089e60`](https://github.com/changesets/changesets/commit/e089e60c6f9d4cbb2040abb1045dcbebc3a559e6) Thanks [@bluwy](https://github.com/bluwy)! - Update markdown dependencies to latest. The returned markdown from `getChangelogEntry` may be formatted differently, but should semantically represent the same content.

### Patch Changes

- [#1476](https://github.com/changesets/changesets/pull/1476) [`e0e1748`](https://github.com/changesets/changesets/commit/e0e1748369b1f936c665b62590a76a0d57d1545e) Thanks [@pralkarz](https://github.com/pralkarz)! - Replace `fs-extra` usage with `node:fs`

- Updated dependencies [[`e0e1748`](https://github.com/changesets/changesets/commit/e0e1748369b1f936c665b62590a76a0d57d1545e), [`6d1f384`](https://github.com/changesets/changesets/commit/6d1f384c8feab091f58443f6f7ee2ada64e0e7cc), [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5), [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7)]:
  - @changesets/read@1.0.0-next.0
  - @changesets/pre@3.0.0-next.0
  - @changesets/types@7.0.0-next.0

## 0.2.5

### Patch Changes

- Updated dependencies [[`f73f84a`](https://github.com/changesets/changesets/commit/f73f84ac2d84d3ccf5ff55c0fc78aaaf3f3da20d)]:
  - @changesets/read@0.6.5

## 0.2.4

### Patch Changes

- Updated dependencies []:
  - @changesets/read@0.6.4

## 0.2.3

### Patch Changes

- Updated dependencies [[`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf)]:
  - @changesets/types@6.1.0
  - @changesets/pre@2.0.2
  - @changesets/read@0.6.3

## 0.2.2

### Patch Changes

- [#1514](https://github.com/changesets/changesets/pull/1514) [`962ab91`](https://github.com/changesets/changesets/commit/962ab918bc2deb89012a0cefce10387997cc54ed) Thanks [@nicoalonsop](https://github.com/nicoalonsop)! - Update spawndamnit to fix [cross-spawn vulnerability](https://security.snyk.io/vuln/SNYK-JS-CROSSSPAWN-8303230)

- Updated dependencies [[`82cacb2`](https://github.com/changesets/changesets/commit/82cacb2227cf3a215cd9d29b9fb0c860f20ba2ca)]:
  - @changesets/read@0.6.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`bc75c1a`](https://github.com/changesets/changesets/commit/bc75c1a74c2d46e08620c7aa0e9f4f5ef40a9b55), [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890)]:
  - @changesets/read@0.6.1
  - @changesets/pre@2.0.1

## 0.2.0

### Minor Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/types@6.0.0
  - @changesets/read@0.6.0
  - @changesets/pre@2.0.0

## 0.1.13

### Patch Changes

- [#1176](https://github.com/changesets/changesets/pull/1176) [`41988ce`](https://github.com/changesets/changesets/commit/41988ceb8c1cedd3857c939448bf3965494ff0a4) Thanks [@joshwooding](https://github.com/joshwooding)! - Bump [`semver`](https://github.com/npm/node-semver) dependency to v7.5.3

## 0.1.12

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1
  - @changesets/read@0.5.9
  - @changesets/pre@1.0.14

## 0.1.11

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0
  - @changesets/read@0.5.8
  - @changesets/pre@1.0.13

## 0.1.10

### Patch Changes

- Updated dependencies []:
  - @changesets/read@0.5.7

## 0.1.9

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0
  - @changesets/read@0.5.6
  - @changesets/pre@1.0.12

## 0.1.8

### Patch Changes

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0
  - @changesets/pre@1.0.11
  - @changesets/read@0.5.5

## 0.1.7

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0
  - @changesets/pre@1.0.10
  - @changesets/read@0.5.4

## 0.1.6

### Patch Changes

- Updated dependencies []:
  - @changesets/read@0.5.3

## 0.1.5

### Patch Changes

- Updated dependencies [[`82be80e`](https://github.com/changesets/changesets/commit/82be80ecfe9288535071e850ae56f2e7a7006eba)]:
  - @changesets/pre@1.0.9

## 0.1.4

### Patch Changes

- [#667](https://github.com/changesets/changesets/pull/667) [`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce) Thanks [@fz6m](https://github.com/fz6m)! - Upgraded `@manypkg/get-packages` dependency to fix getting correct packages in pnpm workspaces with exclude rules.

- Updated dependencies [[`fe8db75`](https://github.com/changesets/changesets/commit/fe8db7500f81caea9064f8bec02bcb77e0fd8fce), [`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/pre@1.0.8
  - @changesets/types@4.0.2
  - @changesets/read@0.5.2

## 0.1.3

### Patch Changes

- Updated dependencies []:
  - @changesets/read@0.5.1

## 0.1.2

### Patch Changes

- Updated dependencies [[`bc611cf`](https://github.com/changesets/changesets/commit/bc611cf2104ff8170e9ea8acb10952ea8cc2a784), [`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/read@0.5.0
  - @changesets/types@4.0.1
  - @changesets/pre@1.0.7

## 0.1.1

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0
  - @changesets/pre@1.0.6
  - @changesets/read@0.4.7

## 0.1.0

### Minor Changes

- [`f5aa35b`](https://github.com/changesets/changesets/commit/f5aa35b2818c9a1b448627eb9c2da8ee50a4fbca) [#501](https://github.com/changesets/changesets/pull/501) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Expose `getChangelogEntry` and `sortChangelogEntries`
