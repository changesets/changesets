# @changesets/write

## 1.0.0-next.8

### Patch Changes

- Updated dependencies [[`b5e1762`](https://github.com/changesets/changesets/commit/b5e1762584718ec607ea79db0a00ae4238f8a784)]:
  - @changesets/types@7.0.0-next.8

## 1.0.0-next.7

### Patch Changes

- [#2160](https://github.com/changesets/changesets/pull/2160) [`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640) Thanks [@beeequeue](https://github.com/beeequeue)! - Added or modified the `files` property in the manifest. This should not change any behavior.
- Updated dependencies [[`162419d`](https://github.com/changesets/changesets/commit/162419dc99278cbdd52db6eabfecd7b8b4eac640)]:
  - @changesets/types@7.0.0-next.7

## 1.0.0-next.6

### Patch Changes

- Updated dependencies [[`4c26f2f`](https://github.com/changesets/changesets/commit/4c26f2faac89b53d3305cf73c9e9cfca5aa88f5f), [`813bbf3`](https://github.com/changesets/changesets/commit/813bbf314d051bfee3b46a793f94b396ef2a4df1)]:
  - @changesets/types@7.0.0-next.6

## 1.0.0-next.5

### Patch Changes

- Updated dependencies [[`88f2abb`](https://github.com/changesets/changesets/commit/88f2abb5e14748b08e3441fd871df60dd1c4737f)]:
  - @changesets/types@7.0.0-next.5

## 1.0.0-next.4

### Minor Changes

- [#1994](https://github.com/changesets/changesets/pull/1994) [`062530b`](https://github.com/changesets/changesets/commit/062530b825d53abc9d8934f3a50cc61ff3ff82b8) Thanks [@bluwy](https://github.com/bluwy)! - Changeset files are now formatted with [@changesets/format](https://github.com/changesets/format) instead of depending on Prettier directly. Formatter selection can be auto-detected from the project configuration or controlled via the `format` config option.

### Patch Changes

- Updated dependencies [[`062530b`](https://github.com/changesets/changesets/commit/062530b825d53abc9d8934f3a50cc61ff3ff82b8)]:
  - @changesets/types@7.0.0-next.4

## 1.0.0-next.3

### Major Changes

- [#1954](https://github.com/changesets/changesets/pull/1954) [`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069) Thanks [@beeequeue](https://github.com/beeequeue)! - Bumped supported Node versions to `^22.11 || ^24 || >=26`

### Minor Changes

- [#1969](https://github.com/changesets/changesets/pull/1969) [`2c7c043`](https://github.com/changesets/changesets/commit/2c7c043d7071440009f8a69eff0b0c6746ac7625) Thanks [@marcalexiei](https://github.com/marcalexiei)! - Add a named export that mirrors the current `default` export

  The `default` export is slated for removal in the next major release, so this ensures a smoother transition path.

### Patch Changes

- Updated dependencies [[`ed6728c`](https://github.com/changesets/changesets/commit/ed6728ce3c089caaee19f71194a0cd7029480069), [`a0b5326`](https://github.com/changesets/changesets/commit/a0b5326570e8e7bf5e35c1cefe8f70d9a51a5cd7)]:
  - @changesets/types@7.0.0-next.3

## 1.0.0-next.2

### Patch Changes

- Updated dependencies [[`c19b112`](https://github.com/changesets/changesets/commit/c19b1123d27986da0e14e99d65b0f9a408def35c)]:
  - @changesets/types@7.0.0-next.2

## 1.0.0-next.1

### Minor Changes

- [#1656](https://github.com/changesets/changesets/pull/1656) [`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d) Thanks [@bluwy](https://github.com/bluwy)! - Bumps minimum node version to `>=20.0.0`

### Patch Changes

- Updated dependencies [[`268a29f`](https://github.com/changesets/changesets/commit/268a29fedc948f22c672a3b1e3e51df4427f478d)]:
  - @changesets/types@7.0.0-next.1

## 1.0.0-next.0

### Major Changes

- [#1482](https://github.com/changesets/changesets/pull/1482) [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7) Thanks [@Andarist](https://github.com/Andarist)! - From now on this package is going to be published as ES module.

### Minor Changes

- [#1479](https://github.com/changesets/changesets/pull/1479) [`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5) Thanks [@bluwy](https://github.com/bluwy)! - Add `"engines"` field for explicit node version support. The supported node versions are `>=18.0.0`.

### Patch Changes

- [#1476](https://github.com/changesets/changesets/pull/1476) [`e0e1748`](https://github.com/changesets/changesets/commit/e0e1748369b1f936c665b62590a76a0d57d1545e) Thanks [@pralkarz](https://github.com/pralkarz)! - Replace `fs-extra` usage with `node:fs`

- Updated dependencies [[`7f34a00`](https://github.com/changesets/changesets/commit/7f34a00aab779a941a406b17f5a85895144fc0a5), [`df424a4`](https://github.com/changesets/changesets/commit/df424a4a09eea15b0fa9159ee0b98af0d95f58a7)]:
  - @changesets/types@7.0.0-next.0

## 0.4.0

### Minor Changes

- [#1453](https://github.com/changesets/changesets/pull/1453) [`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf) Thanks [@bennypowers](https://github.com/bennypowers)! - Added a new option to opt-out from formatting with Prettier using `prettier: false`.

### Patch Changes

- Updated dependencies [[`84a4a1b`](https://github.com/changesets/changesets/commit/84a4a1b1d399bfd0a58677b0182b9c053194febf)]:
  - @changesets/types@6.1.0

## 0.3.2

### Patch Changes

- [#1445](https://github.com/changesets/changesets/pull/1445) [`52c302a`](https://github.com/changesets/changesets/commit/52c302a48a662f71585f18f91dad3cbe49d75890) Thanks [@bluwy](https://github.com/bluwy)! - Remove unused `@babel/runtime` dependency

## 0.3.1

### Patch Changes

- [#1351](https://github.com/changesets/changesets/pull/1351) [`c6da182`](https://github.com/changesets/changesets/commit/c6da182ece2ec40974f15f3efcf9d9ba20cf122b) Thanks [@TheHolyWaffle](https://github.com/TheHolyWaffle)! - Fix an issue with not applying a custom `.prettierrc` configuration with `prettier@>= 3.1.1`

## 0.3.0

### Minor Changes

- [#1185](https://github.com/changesets/changesets/pull/1185) [`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a) Thanks [@Andarist](https://github.com/Andarist)! - `package.json#exports` have been added to limit what (and how) code might be imported from the package.

### Patch Changes

- Updated dependencies [[`a971652`](https://github.com/changesets/changesets/commit/a971652ec1403aab3fb89eb2f1640bd5012b895a)]:
  - @changesets/types@6.0.0

## 0.2.3

### Patch Changes

- Updated dependencies [[`521205d`](https://github.com/changesets/changesets/commit/521205dc8c70fe71b181bd3c4bb7c9c6d2e721d2)]:
  - @changesets/types@5.2.1

## 0.2.2

### Patch Changes

- [#983](https://github.com/changesets/changesets/pull/983) [`6cc4300`](https://github.com/changesets/changesets/commit/6cc430013a052dc2488b9e6700a1e4bd8c8e0680) Thanks [@Andarist](https://github.com/Andarist)! - Improved compatibility with the alpha releases of Prettier v3 by awaiting the `.format` result since it's a promise in that version.

## 0.2.1

### Patch Changes

- Updated dependencies [[`8c08469`](https://github.com/changesets/changesets/commit/8c0846977597ddaf51aaeb35f1f0f9428bf8ba14)]:
  - @changesets/types@5.2.0

## 0.2.0

### Minor Changes

- [#905](https://github.com/changesets/changesets/pull/905) [`c140171`](https://github.com/changesets/changesets/commit/c1401716cf5ee839aaa02ea7ff8f23f8af8bf5b0) Thanks [@Andarist](https://github.com/Andarist)! - The local version of Prettier is going to be preferred from now on when writing formatted `.md` files back to disk. At the same time the version of Prettier that we depend on has been upgraded.

## 0.1.9

### Patch Changes

- Updated dependencies [[`dd9b76f`](https://github.com/changesets/changesets/commit/dd9b76f162a546ae8b412e0cb10277f971f3585e)]:
  - @changesets/types@5.1.0

## 0.1.8

### Patch Changes

- Updated dependencies [[`c87eba6`](https://github.com/changesets/changesets/commit/c87eba6f80a34563b7382f87472c29f6dafb546c)]:
  - @changesets/types@5.0.0

## 0.1.7

### Patch Changes

- Updated dependencies [[`27a5a82`](https://github.com/changesets/changesets/commit/27a5a82188914570d192162f9d045dfd082a3c15)]:
  - @changesets/types@4.1.0

## 0.1.6

### Patch Changes

- Updated dependencies [[`9a993ba`](https://github.com/changesets/changesets/commit/9a993ba09629c1620d749432520470cec49d3a96)]:
  - @changesets/types@4.0.2

## 0.1.5

### Patch Changes

- Updated dependencies [[`e89e28a`](https://github.com/changesets/changesets/commit/e89e28a05f5fa43307db73812a6bcd269b62ddee)]:
  - @changesets/types@4.0.1

## 0.1.4

### Patch Changes

- Updated dependencies [[`de2b4a5`](https://github.com/changesets/changesets/commit/de2b4a5a7b244a37d94625bcb70ecde9dde5b612)]:
  - @changesets/types@4.0.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`2b49d66`](https://github.com/changesets/changesets/commit/2b49d668ecaa1333bc5c7c5be4648dda1b11528d)]:
  - @changesets/types@3.0.0

## 0.1.2

### Patch Changes

- [`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716) [#321](https://github.com/changesets/changesets/pull/321) Thanks [@mitchellhamilton](https://github.com/mitchellhamilton)! - Fix TypeScript declarations

- Updated dependencies [[`1706fb7`](https://github.com/changesets/changesets/commit/1706fb751ecc2f5a792c42f467b2063078d58716)]:
  - @changesets/types@2.0.1

## 0.1.1

### Patch Changes

- Updated dependencies [[`011d57f`](https://github.com/changesets/changesets/commit/011d57f1edf9e37f75a8bef4f918e72166af096e)]:
  - @changesets/types@2.0.0

## 0.1.0

### Minor Changes

- [`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997) [#292](https://github.com/changesets/changesets/pull/292) Thanks [@acheronfail](https://github.com/acheronfail)! - Initial release

### Patch Changes

- Updated dependencies [[`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`cc8c921`](https://github.com/changesets/changesets/commit/cc8c92143d4c4b7cca8b9917dfc830a40b5cda20), [`2363366`](https://github.com/changesets/changesets/commit/2363366756d1b15bddf6d803911baccfca03cbdf), [`41e2e3d`](https://github.com/changesets/changesets/commit/41e2e3dd1053ff2f35a1a07e60793c9099f26997)]:
  - @changesets/types@1.0.0
  - @changesets/parse@0.3.2
