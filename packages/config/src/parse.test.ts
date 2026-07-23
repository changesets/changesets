import path from "node:path";
import { testdir } from "@changesets/test-utils";
import type { Config, Packages, WrittenConfig } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "./defaults.ts";
import { readConfig, validateConfig } from "./parse.ts";

describe("readConfig", () => {
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

    const result = await readConfig(cwd);
    expect(result.errors).toBeUndefined();
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
        "stagedPublishing": false,
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

    const result = await readConfig(path.join(cwd, "packages", "foo"));
    expect(result.errors).toBeUndefined();
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

    const { ["$schema" as never]: _, ...rest } = defaultConfig;
    const result = await readConfig(cwd);
    expect(result.config).toStrictEqual(rest);
  });
});

describe("defaultConfig", () => {
  it("creates the default config", () => {
    expect(defaultConfig).toMatchInlineSnapshot(`
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
        "stagedPublishing": false,
        "updateInternalDependencies": "patch",
      }
    `);
  });
});

const rootManifest = { name: "root", private: true, version: "0.0.0" };

const getDefaultPackages = (cwd: string) =>
  ({
    rootPackage: {
      packageJson: rootManifest,
      dir: cwd,
    },
    rootDir: cwd,
    packages: [],
    tool: { type: "pnpm" },
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
      { name: "defaults", config: {}, expected: defaultConfig },
      {
        name: "changelog: string",
        config: { changelog: "some-module" },
        expected: { ...defaultConfig, changelog: ["some-module", null] },
      },
      {
        name: "changelog: false",
        config: { changelog: false },
        expected: { ...defaultConfig, changelog: false },
      },
      {
        name: "changelog: tuple",
        config: { changelog: ["some-module", { something: true }] },
        expected: {
          ...defaultConfig,
          changelog: ["some-module", { something: true }],
        },
      },
      {
        name: "commit: false",
        config: { commit: false },
        expected: { ...defaultConfig, commit: false },
      },
      {
        name: "commit: true",
        config: { commit: true },
        expected: {
          ...defaultConfig,
          commit: ["@changesets/cli/commit", { skipCI: "version" }],
        },
      },
      {
        name: "commit: custom",
        config: { commit: ["./some-module", { customOption: true }] },
        expected: {
          ...defaultConfig,
          commit: ["./some-module", { customOption: true }],
        },
      },
      {
        name: "access: restricted",
        config: { access: "restricted" },
        expected: { ...defaultConfig, access: "restricted" },
      },
      {
        name: "access: public",
        config: { access: "public" },
        expected: { ...defaultConfig, access: "public" },
      },
      {
        name: "changedFilePatterns",
        config: { changedFilePatterns: ["src/**"] },
        expected: { ...defaultConfig, changedFilePatterns: ["src/**"] },
      },
      {
        name: "fixed",
        config: { fixed: [["pkg-a", "pkg-b"]] },
        expected: { ...defaultConfig, fixed: [["pkg-a", "pkg-b"]] },
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
          ...defaultConfig,
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
          ...defaultConfig,
          fixed: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "linked",
        config: { linked: [["pkg-a", "pkg-b"]] },
        expected: { ...defaultConfig, linked: [["pkg-a", "pkg-b"]] },
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
          ...defaultConfig,
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
          ...defaultConfig,
          linked: [["pkg-*", "!pkg-b", "@pkg/*"], ["@pkg-other/a"]],
        },
      },
      {
        name: "ignore",
        config: { ignore: ["pkg-a", "pkg-b"] },
        expected: { ...defaultConfig, ignore: ["pkg-a", "pkg-b"] },
      },
      {
        name: "ignore: Globs",
        pkgs: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        config: { ignore: ["pkg-*", "@pkg/*"] },
        expected: {
          ...defaultConfig,
          ignore: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        },
      },
      {
        name: "ignore: globs with exclusions",
        pkgs: ["pkg-a", "pkg-b", "@pkg/a", "@pkg/b"],
        config: { ignore: ["pkg-*", "!pkg-b", "@pkg/*"] },
        expected: { ...defaultConfig, ignore: ["pkg-a", "@pkg/a", "@pkg/b"] },
      },
      {
        name: "ignore: allows unmatched globs",
        pkgs: ["pkg-a", "pkg-b"],
        config: { ignore: ["not-a-valid-package"] },
        expected: { ...defaultConfig, ignore: [] },
      },
      {
        name: "privatePackages: false",
        config: { privatePackages: false },
        expected: {
          ...defaultConfig,
          privatePackages: { version: false, tag: false },
        },
      },
      {
        name: "updateInternalDependencies: minor",
        config: { updateInternalDependencies: "minor" },
        expected: { ...defaultConfig, updateInternalDependencies: "minor" },
      },
      {
        name: "updateInternalDependencies: patch",
        config: { updateInternalDependencies: "patch" },
        expected: { ...defaultConfig, updateInternalDependencies: "patch" },
      },
      {
        name: "updateInternalDependents",
        config: {
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            updateInternalDependents: "always",
          },
        },
        expected: {
          ...defaultConfig,
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
        expect(result.errors).toBeUndefined();
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
            expect(result.errors![i]).toContain(errors[i]);
          }
        } else {
          expect(result.errors).toBeUndefined();
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
        expect(result.errors![0]).toContain(
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
        expect(result.errors).toBeUndefined();
      });
    });
  });
});
