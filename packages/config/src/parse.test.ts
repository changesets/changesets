import path from "node:path";
import { testdir } from "@changesets/test-utils";
import type { Config, WrittenConfig } from "@changesets/types";
import { getPackages, type Packages } from "@manypkg/get-packages";
import { describe, expect, it } from "vitest";
import { getDefaultConfig } from "./defaults.ts";
import {
  readAndValidateConfig,
  readConfigFile,
  validateConfig,
} from "./parse.ts";

const omit = <Obj extends Record<string, unknown>>(
  obj: Obj,
  keys: (keyof Obj)[] | string[],
): typeof keys extends keyof Obj ? Omit<Obj, typeof keys> : Obj =>
  Object.fromEntries(
    Object.entries(obj).filter(([k]) => !keys.includes(k)),
  ) as never;

describe("readConfigFile", () => {
  it("can read a config file", async () => {
    const writtenConfig = {
      changelog: false,
      commit: true,
    };

    const cwd = await testdir({
      ".changeset/config.json": JSON.stringify(writtenConfig),
      "package.json": JSON.stringify({
        name: "test-pkg",
        version: "1.0.0",
      }),
    });

    const result = await readConfigFile(cwd);
    expect(result).toStrictEqual(writtenConfig);
  });

  // it should be passed the monorepo root directory, not search for it by itself
  it("does not check the monorepo root for config files, only the cwd", async () => {
    const writtenConfig = {
      changelog: false,
      commit: true,
    };

    const cwd = await testdir({
      ".changeset/config.json": JSON.stringify(writtenConfig),
      "package.json": JSON.stringify({
        name: "root",
        private: true,
      }),
      "packages/foo/package.json": JSON.stringify({
        name: "foo",
        version: "1.0.0",
      }),
    });

    await expect(
      readConfigFile(path.join(cwd, "packages", "foo")),
    ).rejects.toThrow("no such file or directory");
  });
});

describe("readAndValidateConfig", () => {
  it("can read a config file", async () => {
    const writtenConfig = {
      changelog: false,
      commit: true,
    };

    const cwd = await testdir({
      ".changeset/config.json": JSON.stringify(writtenConfig),
      "package.json": JSON.stringify({
        name: "test-pkg",
        version: "1.0.0",
      }),
    });

    const result = await readAndValidateConfig(cwd);
    expect(result.errors).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
    expect(result.config).toMatchInlineSnapshot(`
      {
        "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
          "onlyUpdatePeerDependentsWhenOutOfRange": false,
          "updateInternalDependents": "out-of-range",
        },
        "access": "restricted",
        "baseBranch": "main",
        "bumpVersionsWithWorkspaceProtocolOnly": false,
        "changedFilePatterns": [
          "**",
        ],
        "changelog": false,
        "commit": [
          "@changesets/cli/commit",
          {
            "skipCI": "version",
          },
        ],
        "fixed": [],
        "format": "auto",
        "ignore": [],
        "linked": [],
        "privatePackages": {
          "tag": false,
          "version": true,
        },
        "snapshot": {
          "useCalculatedVersion": false,
        },
        "updateInternalDependencies": "patch",
      }
    `);
  });

  it("reads config files from the monorepo root", async () => {
    const writtenConfig = {
      changelog: false,
      commit: true,
    };

    const cwd = await testdir({
      ".changeset/config.json": JSON.stringify(writtenConfig),
      "package.json": JSON.stringify({
        name: "test-pkg",
        version: "1.0.0",
      }),
      "packages/foo/package.json": JSON.stringify({
        name: "foo",
        version: "1.0.0",
      }),
      "pnpm-lockfile.yaml": "",
      "pnpm-workspace.yaml": "packages: ['packages/*']",
    });

    const result = await readAndValidateConfig(
      path.join(cwd, "packages", "foo"),
    );
    expect(result.errors).toStrictEqual([]);
    expect(result.warnings).toStrictEqual([]);
  });

  it("returns the correct default config if passed an empty object", async () => {
    const cwd = await testdir({
      ".changeset/config.json": JSON.stringify({}),
      "package.json": JSON.stringify({
        name: "test-pkg",
        version: "1.0.0",
      }),
      "packages/foo/package.json": JSON.stringify({
        name: "foo",
        version: "1.0.0",
      }),
      "pnpm-lockfile.yaml": "",
      "pnpm-workspace.yaml": "packages: ['packages/*']",
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ["$schema" as never]: _, ...defaultConfig } = getDefaultConfig();
    const result = await readAndValidateConfig(cwd);
    expect(result.config).toStrictEqual(defaultConfig);
  });
});

describe("defaultConfig", () => {
  it("creates the default config", () => {
    const result = getDefaultConfig();
    expect(omit(result, ["$schema"])).toMatchInlineSnapshot(`
      {
        "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
          "onlyUpdatePeerDependentsWhenOutOfRange": false,
          "updateInternalDependents": "out-of-range",
        },
        "access": "restricted",
        "baseBranch": "main",
        "bumpVersionsWithWorkspaceProtocolOnly": false,
        "changedFilePatterns": [
          "**",
        ],
        "changelog": [
          "@changesets/cli/changelog",
          null,
        ],
        "commit": false,
        "fixed": [],
        "format": "auto",
        "ignore": [],
        "linked": [],
        "privatePackages": {
          "tag": false,
          "version": true,
        },
        "snapshot": {
          "useCalculatedVersion": false,
        },
        "updateInternalDependencies": "patch",
      }
    `);
  });
});

const rootManifest = { name: "root", private: true, version: "0.0.0" };

const defaults = omit(getDefaultConfig(), ["$schema"]);

const getDefaultPackages = (cwd: string) =>
  ({
    rootPackage: {
      packageJson: rootManifest,
      dir: cwd,
      relativeDir: "./",
    },
    rootDir: cwd,
    packages: [],
    tool: { type: "pnpm" } as never,
  }) as Packages;

const withPackages = (cwd: string, pkgNames: string[]): Packages => ({
  ...getDefaultPackages(cwd),
  packages: pkgNames.map((pkgName) => ({
    packageJson: { name: pkgName, version: "1.0.0" },
    dir: path.join(cwd, "packages", pkgName),
    relativeDir: path.join("packages", pkgName),
  })),
});

describe("validateConfig", () => {
  type ValidCase = {
    name: string;
    config: WrittenConfig;
    pkgs?: string[];
    expected: Config;
  };

  describe("valid", () => {
    const validCases: Array<ValidCase> = [
      { name: "defaults", config: {}, expected: defaults },
      {
        name: "changelog: string",
        config: { changelog: "some-module" },
        expected: { ...defaults, changelog: ["some-module", null] },
      },
      {
        name: "changelog: false",
        config: { changelog: false },
        expected: { ...defaults, changelog: false },
      },
      {
        name: "changelog: tuple",
        config: { changelog: ["some-module", { something: true }] },
        expected: {
          ...defaults,
          changelog: ["some-module", { something: true }],
        },
      },
      {
        name: "commit: false",
        config: { commit: false },
        expected: { ...defaults, commit: false },
      },
      {
        name: "commit: true",
        config: { commit: true },
        expected: {
          ...defaults,
          commit: ["@changesets/cli/commit", { skipCI: "version" }],
        },
      },
      {
        name: "commit: custom",
        config: { commit: ["./some-module", { customOption: true }] },
        expected: {
          ...defaults,
          commit: ["./some-module", { customOption: true }],
        },
      },
      {
        name: "access: restricted",
        config: { access: "restricted" },
        expected: { ...defaults, access: "restricted" },
      },
      {
        name: "access: public",
        config: { access: "public" },
        expected: { ...defaults, access: "public" },
      },
      {
        name: "changedFilePatterns",
        config: { changedFilePatterns: ["src/**"] },
        expected: { ...defaults, changedFilePatterns: ["src/**"] },
      },
      {
        name: "fixed",
        config: { fixed: [["pkg-a", "pkg-b"]] },
        expected: { ...defaults, fixed: [["pkg-a", "pkg-b"]] },
      },
      {
        name: "fixed: globs",
        pkgs: [
          "pkg-a",
          "pkg-b",
          "@pkg/a",
          "@pkg/b",
          "@pkg-other/a",
          "@pkg-other/b",
        ],
        config: { fixed: [["pkg-*", "@pkg/*"], ["@pkg-other/a"]] },
        expected: {
          ...defaults,
          fixed: [["pkg-*", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "fixed: globs with exclusions",
        pkgs: [
          "pkg-a",
          "pkg-b",
          "@pkg/a",
          "@pkg/b",
          "@pkg-other/a",
          "@pkg-other/b",
        ],
        config: { fixed: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]] },
        expected: {
          ...defaults,
          fixed: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "linked",
        config: { linked: [["pkg-a", "pkg-b"]] },
        expected: { ...defaults, linked: [["pkg-a", "pkg-b"]] },
      },
      {
        name: "linked: globs",
        pkgs: [
          "pkg-a",
          "pkg-b",
          "@pkg/a",
          "@pkg/b",
          "@pkg-other/a",
          "@pkg-other/b",
        ],
        config: { linked: [["pkg-*", "@pkg/*"], ["@pkg-other/a"]] },
        expected: {
          ...defaults,
          linked: [["pkg-*", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "linked: globs with exclusion",
        pkgs: [
          "pkg-a",
          "pkg-b",
          "@pkg/a",
          "@pkg/b",
          "@pkg-other/a",
          "@pkg-other/b",
        ],
        config: { linked: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]] },
        expected: {
          ...defaults,
          linked: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "ignore",
        config: { ignore: ["pkg-a", "pkg-b"] },
        expected: { ...defaults, ignore: ["pkg-a", "pkg-b"] },
      },
      {
        name: "ignore: Globs",
        pkgs: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        config: { ignore: ["pkg-*", "@pkg/*"] },
        expected: {
          ...defaults,
          ignore: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        },
      },
      {
        name: "ignore: globs with exclusions",
        pkgs: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        config: { ignore: ["pkg-*", "!pkg-b", "@pkg/*"] },
        expected: { ...defaults, ignore: ["pkg-a", "@pkg/a", "@pkg/b"] },
      },
      {
        name: "privatePackages: false",
        config: { privatePackages: false },
        expected: {
          ...defaults,
          privatePackages: { version: false, tag: false },
        },
      },
      {
        name: "updateInternalDependencies: minor",
        config: { updateInternalDependencies: "minor" },
        expected: { ...defaults, updateInternalDependencies: "minor" },
      },
      {
        name: "updateInternalDependencies: patch",
        config: { updateInternalDependencies: "patch" },
        expected: { ...defaults, updateInternalDependencies: "patch" },
      },
      {
        name: "updateInternalDependents",
        config: {
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            updateInternalDependents: "always",
          },
        },
        expected: {
          ...defaults,
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "always",
          },
        },
      },
    ];

    it.each(validCases)(
      "$name",
      async ({ config, pkgs: packageNames, expected }) => {
        packageNames ??= ["pkg-a", "pkg-b"];

        const cwd = await testdir({
          ".changeset/config.json": JSON.stringify(config),
          "package.json": JSON.stringify(rootManifest),
        });
        const packages = withPackages(cwd, packageNames);

        const result = validateConfig(config, packages);
        expect(result.errors).toStrictEqual([]);
        expect(result.warnings).toStrictEqual([]);
        expect(result.config).toStrictEqual(expected);
      },
    );
  });

  describe("invalid", () => {
    type InvalidCase = {
      name: string;
      pkgs?: string[];
      config: Record<string, unknown>;
      errors?: string[];
      warnings?: string[];
    };

    const invalidCases: Array<InvalidCase> = [
      // changelog
      {
        name: "changelog: empty object",
        config: { changelog: {} },
        errors: ["Invalid type: Expected false, a module path "],
      },
      {
        name: "changelog: tuple with 3 items",
        config: { changelog: ["some-module", "something", "other"] },
        errors: ["Invalid type: Expected false, a module path "],
      },
      {
        name: "changelog: tuple with first value not string",
        config: { changelog: [false, "something"] },
        errors: ["Expected false, a module path "],
      },
      // commit
      {
        name: "commit: invalid value",
        config: { commit: {} },
        errors: ["Expected a boolean, a module path "],
      },
      // access
      {
        name: "access: invalid string",
        config: { access: "something" },
        errors: ['Expected ("public"'],
      },
      {
        name: "access: warns about private",
        config: { access: "private" },
        warnings: ['Deprecated: Use "restricted" instead of "private"'],
      },
      // fixed
      {
        name: "fixed: non-array",
        config: { fixed: {} },
        errors: ["Expected Array"],
      },
      {
        name: "fixed: array of non array",
        config: { fixed: [{}] },
        errors: ["Expected Array"],
      },
      {
        name: "fixed: array of array of non-string",
        config: { fixed: [[{}]] },
        errors: ["Expected string"],
      },
      {
        name: "rule: fixedGroupsExist",
        config: { fixed: [["not-existing"]] },
        warnings: [
          'Invalid path: The package or glob "not-existing" does not match',
        ],
      },
      {
        name: "rule: fixedGroupsExist: glob",
        pkgs: ["pkg-a"],
        config: { fixed: [["pkg-a", "foo/*"]] },
        warnings: ['Invalid path: The package or glob "foo/*" does not match'],
      },
      {
        name: "rule: noDuplicateFixedPackages",
        pkgs: ["pkg-a"],
        config: { fixed: [["pkg-a"], ["pkg-a"]] },
        errors: [
          'Invalid group: The package or glob "pkg-a" is defined in multiple groups',
        ],
      },
      {
        name: "rule: noDuplicateFixedPackages: globs",
        pkgs: ["pkg-a", "pkg-b"],
        config: { fixed: [["pkg-*"], ["pkg-*"]] },
        errors: [
          'Invalid group: The package or glob "pkg-*" is defined in multiple groups',
        ],
      },
      // linked
      {
        name: "linked: non-array",
        config: { linked: {} },
        errors: ["Expected Array"],
      },
      {
        name: "linked: array of non array",
        config: { linked: [{}] },
        errors: ["Expected Array"],
      },
      {
        name: "linked: array of array of non-string",
        config: { linked: [[{}]] },
        errors: ["Expected string"],
      },
      {
        name: "rule: linkedGroupsExist",
        config: { linked: [["not-existing"]] },
        warnings: [
          'Invalid path: The package or glob "not-existing" does not match',
        ],
      },
      {
        name: "rule: linkedGroupsExist: glob",
        pkgs: ["pkg-a"],
        config: { linked: [["pkg-a", "foo/*"]] },
        warnings: ['Invalid path: The package or glob "foo/*" does not match'],
      },
      {
        name: "rule: noDuplicateLinkedPackages",
        pkgs: ["pkg-a"],
        config: { linked: [["pkg-a"], ["pkg-a"]] },
        errors: [
          'Invalid group: The package or glob "pkg-a" is defined in multiple groups',
        ],
      },
      {
        name: "rule: noDuplicateLinkedPackages: globs",
        pkgs: ["pkg-a", "pkg-b"],
        config: { linked: [["pkg-*"], ["pkg-*"]] },
        errors: [
          'Invalid group: The package or glob "pkg-*" is defined in multiple groups',
        ],
      },
      // updateInternalDependencies
      {
        name: "updateInternalDependencies: invalid string",
        config: { updateInternalDependencies: "major" },
        errors: ['Expected ("minor"'],
      },
      // ignore
      {
        name: "ignore: non-array",
        config: { ignore: "string value" },
        errors: ["Expected Array"],
      },
      {
        name: "ignore: array of non-string",
        config: { ignore: [123, "pkg-a"] },
        errors: ["Expected string"],
      },
      {
        name: "rule: ignoredPatternsExist",
        pkgs: [],
        config: { ignore: ["pkg-a"] },
        errors: ['Invalid path: The package or glob "pkg-a" does not match'],
      },
      {
        name: "rule: ignoredPatternsExist: glob",
        pkgs: [],
        config: { ignore: ["pkg-*"] },
        errors: ['Invalid path: The package or glob "pkg-*" does not match'],
      },
      // privatePackages
      {
        name: "privatePackages: should error when a public package depends on a private package skipped via privatePackages.version: false",
        config: { privatePackages: { version: false, tag: false } },
      },
      {
        name: "experimental: onlyUpdatePeerDependentsWhenOutOfRange: non-boolean",
        config: {
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: "not true",
          },
        },
        errors: ["Expected boolean"],
      },
      // snapshot.useCalculatedVersion
      {
        name: "snapshot.useCalculatedVersion: non-boolean",
        config: { snapshot: { useCalculatedVersion: "not true" } },
        errors: ["Expected boolean"],
      },
      // changedFilePatterns
      {
        name: "changedFilePatterns: non-array",
        config: { changedFilePatterns: false },
        errors: ["Expected Array"],
      },
      {
        name: "changedFilePatterns: non-string element",
        config: { changedFilePatterns: ["src/**", 100] },
        errors: ["Expected string"],
      },
    ];

    it.each(invalidCases)(
      "$name",
      async ({ config, pkgs: packageNames, errors, warnings }) => {
        packageNames ??= ["pkg-a", "pkg-b"];

        const cwd = await testdir({
          ".changeset/config.json": JSON.stringify(config),
          "package.json": JSON.stringify(rootManifest),
        });
        const packages = withPackages(cwd, packageNames);

        const result = validateConfig(config, packages);

        /* eslint-disable vitest/no-conditional-expect */
        if (errors != null) {
          expect(result.errors).not.toStrictEqual([]);
          for (let i = 0; i < errors.length; i++) {
            expect(result.errors[i]).toContain(errors[i]);
          }
        } else {
          expect(result.errors).toStrictEqual([]);
        }

        if (warnings != null) {
          expect(result.warnings).not.toStrictEqual([]);
          for (let i = 0; i < warnings.length; i++) {
            expect(result.warnings[i]).toContain(warnings[i]);
          }
        } else {
          expect(result.warnings).toStrictEqual([]);
        }
        /* eslint-enable vitest/no-conditional-expect */
      },
    );
  });

  // any tests that don't fit nicely into the cases above
  describe("rules", () => {
    describe("alsoSkipDependentsOfSkipped", () => {
      it("should error when a not-skipped package depends on a skipped package", async () => {
        const pkgA = {
          name: "pkg-a",
          version: "1.0.0",
          dependencies: { "pkg-b": "1.0.0" },
        };
        const pkgB = { name: "pkg-b", version: "1.0.0" };
        const config = { ignore: ["pkg-b"] };

        const cwd = await testdir({
          ".changeset/config.json": JSON.stringify(config),
          "package.json": JSON.stringify(rootManifest),
          "packages/pkg-a/package.json": JSON.stringify(pkgA),
          "packages/pkg-b/package.json": JSON.stringify(pkgB),
          "pnpm-workspace.yaml": "packages: [packages/*]",
          "pnpm-lock.yaml": "",
        });

        const result = validateConfig(config, await getPackages(cwd));

        expect(result.errors).not.toStrictEqual([]);
        expect(result.errors[0]).toContain(
          'Invalid tree: "pkg-a" depends on the skipped package "pkg-b", but "pkg-a" is not skipped.',
        );
      });

      it("should not error if the dependent is private", async () => {
        const pkgA = {
          name: "pkg-a",
          private: true,
          version: "1.0.0",
          dependencies: { "pkg-b": "1.0.0" },
        };
        const pkgB = { name: "pkg-b", version: "1.0.0" };
        const config = { ignore: ["pkg-b"] };

        const cwd = await testdir({
          ".changeset/config.json": JSON.stringify(config),
          "package.json": JSON.stringify(rootManifest),
          "packages/pkg-a/package.json": JSON.stringify(pkgA),
          "packages/pkg-b/package.json": JSON.stringify(pkgB),
          "pnpm-workspace.yaml": "packages: [packages/*]",
          "pnpm-lock.yaml": "",
        });

        const result = validateConfig(config, await getPackages(cwd));
        expect(result.errors).toStrictEqual([]);
      });
    });
  });
});
