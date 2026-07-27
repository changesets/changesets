import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import {
  type Fixture,
  outputFile,
  temporarilySilenceLogs,
  testdir,
} from "@changesets/test-utils";
import type {
  ComprehensiveRelease,
  Config,
  NewChangeset,
  ReleasePlan,
  PreState,
} from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { describe, expect, it, test } from "vitest";
import { applyReleasePlan } from "./index.ts";

const changesetsCliChangelogPath = path.resolve(
  import.meta.dirname,
  "../../cli/dist/changelog.mjs",
);
const changesetsCliCommitPath = path.resolve(
  import.meta.dirname,
  "../../cli/dist/commit.mjs",
);

class FakeReleasePlan {
  changesets: NewChangeset[];
  releases: ComprehensiveRelease[];
  config: Config;

  constructor(
    changesets: NewChangeset[] = [],
    releases: ComprehensiveRelease[] = [],
    config: Partial<Config> = {},
  ) {
    const baseChangeset: NewChangeset = {
      id: "quick-lions-devour",
      summary: "Hey, let's have fun with testing!",
      releases: [{ name: "pkg-a", type: "minor" }],
    };
    const baseRelease: ComprehensiveRelease = {
      name: "pkg-a",
      type: "minor",
      oldVersion: "1.0.0",
      newVersion: "1.1.0",
      changesets: ["quick-lions-devour"],
    };
    this.config = {
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: "restricted",
      changedFilePatterns: ["**"],
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
      format: "auto",
      privatePackages: { version: true, tag: false },
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange: false,
        updateInternalDependents: "out-of-range",
      },
      snapshot: {
        useCalculatedVersion: false,
        prereleaseTemplate: null,
      },
      ...config,
    };

    this.changesets = [baseChangeset, ...changesets];
    this.releases = [baseRelease, ...releases];
  }

  getReleasePlan(): ReleasePlan {
    return {
      changesets: this.changesets,
      releases: this.releases,
      preState: undefined,
    };
  }
}

async function testSetup(
  fixture: Fixture,
  releasePlan: ReleasePlan,
  config?: Config,
  snapshot?: string,
  setupFunc?: (tempDir: string) => Promise<unknown>,
) {
  if (!config) {
    config = {
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: "restricted",
      changedFilePatterns: ["**"],
      baseBranch: "main",
      updateInternalDependencies: "patch",
      ignore: [],
      format: "auto",
      privatePackages: { version: true, tag: false },
      snapshot: {
        useCalculatedVersion: false,
        prereleaseTemplate: null,
      },
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange: false,
        updateInternalDependents: "out-of-range",
      },
    };
  }
  const tempDir = await testdir(fixture);

  if (setupFunc) {
    await setupFunc(tempDir);
  }

  if (config.commit) {
    await exec("git", ["init"], { nodeOptions: { cwd: tempDir } });
    await git.add(".", tempDir);
    await git.commit("first commit", tempDir);
  }

  const packages = await getPackages(tempDir);

  return {
    changedFiles: await applyReleasePlan(
      releasePlan,
      packages,
      config,
      snapshot,
    ),
    tempDir,
  };
}

async function readJson(path: string) {
  return JSON.parse(await fs.readFile(path, "utf8"));
}

describe("apply release plan", () => {
  describe("versioning", () => {
    describe("formatting", () => {
      it("should not reformat a small array in a package.json", async () => {
        const releasePlan = new FakeReleasePlan();
        const { changedFiles } = await testSetup(
          {
            "package.json": `{
  "name": "pkg-a",
  "version": "1.0.0",
  "files": [
    "lib"
  ]
}`,
          },
          releasePlan.getReleasePlan(),
          releasePlan.config,
        );
        const pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        const pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0",
  "files": [
    "lib"
  ]
}`);
      });
      it("should not change tab indentation in a package.json", async () => {
        const releasePlan = new FakeReleasePlan();
        const { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify(
              {
                name: "pkg-a",
                version: "1.0.0",
              },
              null,
              "\t",
            ),
          },
          releasePlan.getReleasePlan(),
          releasePlan.config,
        );
        const pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        const pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
\t"name": "pkg-a",
\t"version": "1.1.0"
}`);
      });
      it("should not add trailing newlines in a package.json if they don't exist", async () => {
        const releasePlan = new FakeReleasePlan();
        const { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify(
              {
                name: "pkg-a",
                version: "1.0.0",
              },
              null,
              2,
            ),
          },
          releasePlan.getReleasePlan(),
          releasePlan.config,
        );
        const pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        const pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0"
}`);
      });
      it("should not remove trailing newlines in a package.json if they exist", async () => {
        const releasePlan = new FakeReleasePlan();
        const { changedFiles } = await testSetup(
          {
            "package.json":
              JSON.stringify(
                {
                  name: "pkg-a",
                  version: "1.0.0",
                },
                null,
                2,
              ) + "\n",
          },
          releasePlan.getReleasePlan(),
          releasePlan.config,
        );
        const pkgPath = changedFiles.find((a) => a.endsWith(`package.json`));

        if (!pkgPath) throw new Error(`could not find an updated package json`);
        const pkgJSON = await fs.readFile(pkgPath, { encoding: "utf-8" });

        expect(pkgJSON).toStrictEqual(`{
  "name": "pkg-a",
  "version": "1.1.0"
}\n`);
      });
    });

    it("should update a version for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      const pkgJSON = await readJson(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
      });
    });

    it("should not update ranges set to *", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
      );
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "*",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      const pkgJSON = await readJson(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "*",
        },
      });
    });

    it("should update workspace ranges", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
      );
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      const pkgJSON = await readJson(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:1.1.0",
        },
      });
    });

    it("should not update workspace version aliases", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
          {
            id: "some-id",
            releases: [{ name: "pkg-c", type: "minor" }],
            summary: "a very useful summary",
          },
          {
            id: "some-id",
            releases: [{ name: "pkg-d", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-c",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-d",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
      );
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:*",
              "pkg-c": "workspace:^",
              "pkg-d": "workspace:~",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "1.0.0",
          }),
          "packages/pkg-d/package.json": JSON.stringify({
            name: "pkg-d",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      const pkgJSON = await readJson(pkgPath);

      expect(pkgJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:*",
          "pkg-c": "workspace:^",
          "pkg-d": "workspace:~",
        },
      });
    });

    it("should update workspace ranges only with bumpVersionsWithWorkspaceProtocolOnly", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [
              { name: "pkg-b", type: "minor" },
              { name: "pkg-c", type: "minor" },
            ],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
          {
            changesets: ["some-id"],
            name: "pkg-c",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
        {
          bumpVersionsWithWorkspaceProtocolOnly: true,
        },
      );
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgAPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgAPath) throw new Error(`could not find an updated package json`);
      const pkgAJSON = await readJson(pkgAPath);

      expect(pkgAJSON).toEqual({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "workspace:1.1.0",
        },
      });

      const pkgCPath = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}package.json`),
      );

      if (!pkgCPath) throw new Error(`could not find an updated package json`);
      const pkgCJSON = await readJson(pkgCPath);

      expect(pkgCJSON).toEqual({
        name: "pkg-c",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "1.0.0",
        },
      });
    });

    it("should update root dependencies without versioning the root package", async () => {
      const releasePlan = new FakeReleasePlan();
      const { changedFiles, tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            name: "root-pkg",
            workspaces: ["packages/*"],
            devDependencies: {
              "pkg-a": "workspace:^1.0.0",
            },
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );

      const rootPackageJsonPath = path.join(tempDir, "package.json");
      expect(changedFiles).toContain(rootPackageJsonPath);
      expect(await readJson(rootPackageJsonPath)).toEqual({
        private: true,
        name: "root-pkg",
        workspaces: ["packages/*"],
        devDependencies: {
          "pkg-a": "workspace:^1.1.0",
        },
      });
    });

    it("should update a version for two packages with different new versions", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "pkg-b",
            type: "major",
            oldVersion: "1.0.0",
            newVersion: "2.0.0",
            changesets: [],
          },
        ],
      );

      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
      );
      const pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );
      const pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`),
      );

      if (!pkgPathA || !pkgPathB) {
        throw new Error(`could not find an updated package json`);
      }
      const pkgJSONA = await readJson(pkgPathA);
      const pkgJSONB = await readJson(pkgPathB);

      expect(pkgJSONA).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
      });
      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "2.0.0",
      });
    });

    it("should not update the version of the dependent package if the released dep is a dev dep", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            devDependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "none" },
                { name: "pkg-b", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: false,
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          updateInternalDependencies: "patch",
          format: "auto",
          privatePackages: { version: true, tag: false },
          ignore: [],
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );
      const pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );
      const pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`),
      );

      if (!pkgPathA || !pkgPathB) {
        throw new Error(`could not find an updated package json`);
      }
      const pkgJSONA = await readJson(pkgPathA);
      const pkgJSONB = await readJson(pkgPathB);

      expect(pkgJSONA).toMatchObject({
        name: "pkg-a",
        version: "1.0.0",
        devDependencies: {
          "pkg-b": "1.1.0",
        },
      });
      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.1.0",
      });
    });

    it("should skip dependencies that have the same name as the package", async () => {
      const { tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            name: "self-referenced",
            version: "1.0.0",
            devDependencies: {
              "self-referenced": "file:",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "self-referenced", type: "minor" }],
            },
          ],
          releases: [
            {
              name: "self-referenced",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: false,
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          updateInternalDependencies: "patch",
          format: "auto",
          privatePackages: { version: true, tag: false },
          ignore: [],
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );

      const pkgJSON = await readJson(path.join(tempDir, "package.json"));

      expect(pkgJSON).toMatchObject({
        name: "self-referenced",
        version: "1.1.0",
        devDependencies: {
          "self-referenced": "file:",
        },
      });
    });

    it("should not update dependent versions when a package has a changeset type of none", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "^1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "pkg-b", type: "none" }],
            },
          ],
          releases: [
            {
              name: "pkg-b",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        { ...defaultConfig, changelog: false },
      );
      const pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );
      const pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`),
      );

      expect(pkgPathA).toBeUndefined();
      if (!pkgPathB) throw new Error(`could not find an updated package json`);

      const pkgJSONB = await readJson(pkgPathB);

      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.0.0",
      });
    });

    it("should not update workspace dependent versions when a package has a changeset type of none", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "workspace:1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [{ name: "pkg-b", type: "none" }],
            },
          ],
          releases: [
            {
              name: "pkg-b",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        { ...defaultConfig, changelog: false },
      );
      const pkgPathA = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );
      const pkgPathB = changedFiles.find((b) =>
        b.endsWith(`pkg-b${path.sep}package.json`),
      );

      expect(pkgPathA).toBeUndefined();
      if (!pkgPathB) throw new Error(`could not find an updated package json`);

      const pkgJSONB = await readJson(pkgPathB);

      expect(pkgJSONB).toMatchObject({
        name: "pkg-b",
        version: "1.0.0",
      });
    });

    it("should use exact versioning when snapshot release is applied, and ignore any range modifiers", async () => {
      const releasePlan = new FakeReleasePlan(
        [
          {
            id: "some-id",
            releases: [{ name: "pkg-b", type: "minor" }],
            summary: "a very useful summary",
          },
        ],
        [
          {
            changesets: ["some-id"],
            name: "pkg-b",
            newVersion: "1.1.0",
            oldVersion: "1.0.0",
            type: "minor",
          },
        ],
      );
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "^1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
        "canary",
      );

      const pkgPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}package.json`),
      );

      if (!pkgPath) throw new Error(`could not find an updated package json`);
      const pkgJSON = await readJson(pkgPath);

      expect(pkgJSON).toMatchObject({
        name: "pkg-a",
        version: "1.1.0",
        dependencies: {
          "pkg-b": "1.1.0",
        },
      });
    });

    describe("internal dependency bumping", () => {
      describe("updateInternalDependencies set to patch", () => {
        const updateInternalDependencies = "patch";
        it("should update min version ranges of patch bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.0.4",
            },
          });
        });
        it("should still update min version ranges of patch bumped internal dependencies that have left semver range", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                    { name: "pkg-c", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "none",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-c",
                  type: "patch",
                  oldVersion: "2.0.0",
                  newVersion: "2.0.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.1",
              "pkg-a": "^1.0.4",
            },
          });
        });
        it("should update min version ranges of minor bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "minor" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "minor",
                  oldVersion: "1.0.3",
                  newVersion: "1.1.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.1.0",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.1.0",
            },
          });
        });
        it("should update min version ranges of major bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "major" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "major",
                  oldVersion: "1.0.3",
                  newVersion: "2.0.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "2.0.0",
            dependencies: {
              "pkg-b": "~1.2.1",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^2.0.0",
            },
          });
        });
        it("should not update dependant's dependency range when it depends on a tag of a bumped dependency", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "latest",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "bulbasaur",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "latest",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "bulbasaur",
            },
          });
        });
      });
      describe("updateInternalDependencies set to minor", () => {
        const updateInternalDependencies = "minor";
        it("should NOT update min version ranges of patch bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          });
        });
        it("should still update min version ranges of patch bumped internal dependencies that have left semver range", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "patch" },
                    { name: "pkg-b", type: "patch" },
                    { name: "pkg-c", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "patch",
                  oldVersion: "1.0.3",
                  newVersion: "1.0.4",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-c",
                  type: "patch",
                  oldVersion: "2.0.0",
                  newVersion: "2.0.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.0.4",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-c": "2.0.1",
              "pkg-a": "^1.0.3",
            },
          });
        });
        it("should update min version ranges of minor bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-c": "2.0.0",
                  "pkg-a": "^1.0.3",
                },
              }),
              "packages/pkg-c/package.json": JSON.stringify({
                name: "pkg-c",
                version: "2.0.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "minor" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "minor",
                  oldVersion: "1.0.3",
                  newVersion: "1.1.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "1.1.0",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^1.1.0",
            },
          });
        });
        it("should update min version ranges of major bumped internal dependencies", async () => {
          const { changedFiles } = await testSetup(
            {
              "package.json": JSON.stringify({
                private: true,
                workspaces: ["packages/*"],
              }),
              "package-lock.json": "",
              "packages/pkg-a/package.json": JSON.stringify({
                name: "pkg-a",
                version: "1.0.3",
                dependencies: {
                  "pkg-b": "~1.2.0",
                },
              }),
              "packages/pkg-b/package.json": JSON.stringify({
                name: "pkg-b",
                version: "1.2.0",
                dependencies: {
                  "pkg-a": "^1.0.3",
                },
              }),
            },
            {
              changesets: [
                {
                  id: "quick-lions-devour",
                  summary: "Hey, let's have fun with testing!",
                  releases: [
                    { name: "pkg-a", type: "major" },
                    { name: "pkg-b", type: "patch" },
                  ],
                },
              ],
              releases: [
                {
                  name: "pkg-a",
                  type: "major",
                  oldVersion: "1.0.3",
                  newVersion: "2.0.0",
                  changesets: ["quick-lions-devour"],
                },
                {
                  name: "pkg-b",
                  type: "patch",
                  oldVersion: "1.2.0",
                  newVersion: "1.2.1",
                  changesets: ["quick-lions-devour"],
                },
              ],
              preState: undefined,
            },
            {
              changelog: false,
              commit: false,
              fixed: [],
              linked: [],
              access: "restricted",
              changedFilePatterns: ["**"],
              baseBranch: "main",
              updateInternalDependencies,
              ignore: [],
              format: "auto",
              privatePackages: { version: true, tag: false },
              ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
                onlyUpdatePeerDependentsWhenOutOfRange: false,
                updateInternalDependents: "out-of-range",
              },
              snapshot: {
                useCalculatedVersion: false,
                prereleaseTemplate: null,
              },
            },
          );
          const pkgPathA = changedFiles.find((a) =>
            a.endsWith(`pkg-a${path.sep}package.json`),
          );
          const pkgPathB = changedFiles.find((b) =>
            b.endsWith(`pkg-b${path.sep}package.json`),
          );

          if (!pkgPathA || !pkgPathB) {
            throw new Error(`could not find an updated package json`);
          }
          const pkgJSONA = await readJson(pkgPathA);
          const pkgJSONB = await readJson(pkgPathB);

          expect(pkgJSONA).toMatchObject({
            name: "pkg-a",
            version: "2.0.0",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          });
          expect(pkgJSONB).toMatchObject({
            name: "pkg-b",
            version: "1.2.1",
            dependencies: {
              "pkg-a": "^2.0.0",
            },
          });
        });
      });
    });

    describe("onlyUpdatePeerDependentsWhenOutOfRange set to true", () => {
      it("should not bump peerDependencies if they are still in range", async () => {
        const { changedFiles } = await testSetup(
          {
            "package.json": JSON.stringify({
              private: true,
              workspaces: ["packages/*"],
            }),
            "package-lock.json": "",
            "packages/depended-upon/package.json": JSON.stringify({
              name: "depended-upon",
              version: "1.0.0",
            }),
            "packages/has-peer-dep/package.json": JSON.stringify({
              name: "has-peer-dep",
              version: "1.0.0",
              peerDependencies: {
                "depended-upon": "^1.0.0",
              },
            }),
          },
          {
            changesets: [
              {
                id: "quick-lions-devour",
                summary: "Hey, let's have fun with testing!",
                releases: [
                  { name: "depended-upon", type: "patch" },
                  { name: "has-peer-dep", type: "patch" },
                ],
              },
            ],
            releases: [
              {
                name: "has-peer-dep",
                type: "patch",
                oldVersion: "1.0.0",
                newVersion: "1.0.1",
                changesets: ["quick-lions-devour"],
              },
              {
                name: "depended-upon",
                type: "patch",
                oldVersion: "1.0.0",
                newVersion: "1.0.1",
                changesets: ["quick-lions-devour"],
              },
            ],
            preState: undefined,
          },
          {
            changelog: false,
            commit: false,
            fixed: [],
            linked: [],
            access: "restricted",
            changedFilePatterns: ["**"],
            baseBranch: "main",
            updateInternalDependencies: "patch",
            ignore: [],
            format: "auto",
            privatePackages: { version: true, tag: false },
            ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
              onlyUpdatePeerDependentsWhenOutOfRange: true,
              updateInternalDependents: "out-of-range",
            },
            snapshot: {
              useCalculatedVersion: false,
              prereleaseTemplate: null,
            },
          },
        );
        const pkgPathDependent = changedFiles.find((a) =>
          a.endsWith(`has-peer-dep${path.sep}package.json`),
        );
        const pkgPathDepended = changedFiles.find((b) =>
          b.endsWith(`depended-upon${path.sep}package.json`),
        );

        if (!pkgPathDependent || !pkgPathDepended) {
          throw new Error(`could not find an updated package json`);
        }
        const pkgJSONDependent = await readJson(pkgPathDependent);
        const pkgJSONDepended = await readJson(pkgPathDepended);

        expect(pkgJSONDependent).toMatchObject({
          name: "has-peer-dep",
          version: "1.0.1",
          peerDependencies: {
            "depended-upon": "^1.0.0",
          },
        });
        expect(pkgJSONDepended).toMatchObject({
          name: "depended-upon",
          version: "1.0.1",
        });
      });
    });
  });

  describe("changelogs", () => {
    it("should not generate any changelogs", async () => {
      const releasePlan = new FakeReleasePlan();
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: false,
        },
      );

      expect(
        changedFiles.find((a) => a.endsWith(`pkg-a${path.sep}CHANGELOG.md`)),
      ).toBeUndefined();
    });

    it("should update a changelog for one package", async () => {
      const releasePlan = new FakeReleasePlan();
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [changesetsCliChangelogPath, null],
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!"
      `);
    });

    it("should insert new entry before existing version heading when no package title is present", async () => {
      const releasePlan = new FakeReleasePlan();
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "yarn.lock": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
          "packages/pkg-a/CHANGELOG.md":
            "## 1.0.0\n\n### Minor Changes\n\n- Initial release\n",
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [changesetsCliChangelogPath, null],
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");

      expect(readme).toMatchInlineSnapshot(`
        "## 1.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!
        ## 1.0.0

        ### Minor Changes

        - Initial release
        "
      `);
    });

    it("should update a changelog for two packages", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "pkg-b",
            type: "major",
            oldVersion: "1.0.0",
            newVersion: "2.0.0",
            changesets: [],
          },
        ],
      );

      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [changesetsCliChangelogPath, null],
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );
      const readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`),
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      const readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!

        ### Patch Changes

        - pkg-b@2.0.0"
      `);

      expect(readmeB.trim()).toMatchInlineSnapshot(`
        "# pkg-b

        ## 2.0.0"
      `);
    });

    it("should ignore unversioned packages when generating dependency changelog entries", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "pkg-b",
            type: "none",
            oldVersion: undefined,
            newVersion: undefined,
            changesets: [],
          },
        ],
      );

      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            private: true,
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [changesetsCliChangelogPath, null],
          privatePackages: { version: false, tag: false },
        },
      );

      const changelogPath = changedFiles.find((file) =>
        file.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );

      if (!changelogPath) {
        throw new Error(`could not find an updated changelog`);
      }

      const changelog = await fs.readFile(changelogPath, "utf-8");
      expect(changelog.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!"
      `);
    });

    it("should not update the changelog if only devDeps changed", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            devDependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "none" },
                { name: "pkg-b", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "none",
              oldVersion: "1.0.0",
              newVersion: "1.0.0",
              changesets: [],
            },
            {
              name: "pkg-b",
              type: "minor",
              oldVersion: "1.0.0",
              newVersion: "1.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          baseBranch: "main",
          changedFilePatterns: ["**"],
          changelog: [changesetsCliChangelogPath, null],
          updateInternalDependencies: "patch",
          ignore: [],
          format: "auto",
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );
      const pkgAChangelogPath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );

      expect(pkgAChangelogPath).toBeUndefined();
    });

    test("should list multi-line same-type summaries correctly", async () => {
      const releasePlan = new FakeReleasePlan([
        {
          id: "some-id-1",
          summary: "Random stuff\n\nget it while it's hot!",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
        {
          id: "some-id-2",
          summary: "New feature, much wow\n\nlook at this shiny stuff!",
          releases: [{ name: "pkg-a", type: "minor" }],
        },
      ]);
      releasePlan.releases[0].changesets.push("some-id-1", "some-id-2");

      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          changelog: [changesetsCliChangelogPath, null],
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );

      if (!readmePath) throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!
        - Random stuff
          
          get it while it's hot!
        - New feature, much wow
          
          look at this shiny stuff!"
      `);
    });

    it("should add an updated dependencies line when dependencies have been updated", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [changesetsCliChangelogPath, null],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "patch",
          ignore: [],
          format: "auto",
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );
      const readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`),
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      const readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.0.4

        ### Patch Changes

        - Hey, let's have fun with testing!
        - Updated dependencies
          - pkg-b@1.2.1"
      `);

      expect(readmeB.trim()).toMatchInlineSnapshot(`
        "# pkg-b

        ## 1.2.1

        ### Patch Changes

        - Hey, let's have fun with testing!
        - Updated dependencies
          - pkg-a@1.0.4"
      `);
    });

    it("should NOT add updated dependencies line if dependencies have NOT been updated", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [changesetsCliChangelogPath, null],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          format: "auto",
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );
      const readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`),
      );

      if (!readmePath || !readmePathB)
        throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      const readmeB = await fs.readFile(readmePathB, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.0.4

        ### Patch Changes

        - Hey, let's have fun with testing!"
      `);

      expect(readmeB.trim()).toMatchInlineSnapshot(`
        "# pkg-b

        ## 1.2.1

        ### Patch Changes

        - Hey, let's have fun with testing!"
      `);
    });

    it("should only add updated dependencies line for dependencies that have been updated", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.0",
              "pkg-a": "^1.0.3",
            },
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "2.0.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
                { name: "pkg-c", type: "minor" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-c",
              type: "minor",
              oldVersion: "2.0.0",
              newVersion: "2.1.0",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [changesetsCliChangelogPath, null],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          format: "auto",
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );
      const readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`),
      );
      const readmePathC = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}CHANGELOG.md`),
      );

      if (!readmePath || !readmePathB || !readmePathC)
        throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      const readmeB = await fs.readFile(readmePathB, "utf-8");
      const readmeC = await fs.readFile(readmePathC, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.0.4

        ### Patch Changes

        - Hey, let's have fun with testing!"
      `);

      expect(readmeB.trim()).toMatchInlineSnapshot(`
        "# pkg-b

        ## 1.2.1

        ### Patch Changes

        - Hey, let's have fun with testing!
        - Updated dependencies
          - pkg-c@2.1.0"
      `);

      expect(readmeC.trim()).toMatchInlineSnapshot(`
        "# pkg-c

        ## 2.1.0

        ### Minor Changes

        - Hey, let's have fun with testing!"
      `);
    });

    it("should still add updated dependencies line for dependencies that have a bump type less than the minimum internal bump range but leave semver range", async () => {
      const { changedFiles } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.3",
            dependencies: {
              "pkg-b": "~1.2.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.2.0",
            dependencies: {
              "pkg-c": "2.0.0",
              "pkg-a": "^1.0.3",
            },
          }),
          "packages/pkg-c/package.json": JSON.stringify({
            name: "pkg-c",
            version: "2.0.0",
            dependencies: {
              "pkg-a": "^1.0.3",
            },
          }),
        },
        {
          changesets: [
            {
              id: "quick-lions-devour",
              summary: "Hey, let's have fun with testing!",
              releases: [
                { name: "pkg-a", type: "patch" },
                { name: "pkg-b", type: "patch" },
                { name: "pkg-c", type: "patch" },
              ],
            },
          ],
          releases: [
            {
              name: "pkg-a",
              type: "patch",
              oldVersion: "1.0.3",
              newVersion: "1.0.4",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-b",
              type: "patch",
              oldVersion: "1.2.0",
              newVersion: "1.2.1",
              changesets: ["quick-lions-devour"],
            },
            {
              name: "pkg-c",
              type: "patch",
              oldVersion: "2.0.0",
              newVersion: "2.0.1",
              changesets: ["quick-lions-devour"],
            },
          ],
          preState: undefined,
        },
        {
          changelog: [changesetsCliChangelogPath, null],
          commit: false,
          fixed: [],
          linked: [],
          access: "restricted",
          changedFilePatterns: ["**"],
          baseBranch: "main",
          updateInternalDependencies: "minor",
          ignore: [],
          format: "auto",
          privatePackages: { version: true, tag: false },
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            onlyUpdatePeerDependentsWhenOutOfRange: false,
            updateInternalDependents: "out-of-range",
          },
          snapshot: {
            useCalculatedVersion: false,
            prereleaseTemplate: null,
          },
        },
      );

      const readmePath = changedFiles.find((a) =>
        a.endsWith(`pkg-a${path.sep}CHANGELOG.md`),
      );
      const readmePathB = changedFiles.find((a) =>
        a.endsWith(`pkg-b${path.sep}CHANGELOG.md`),
      );
      const readmePathC = changedFiles.find((a) =>
        a.endsWith(`pkg-c${path.sep}CHANGELOG.md`),
      );

      if (!readmePath || !readmePathB || !readmePathC)
        throw new Error(`could not find an updated changelog`);
      const readme = await fs.readFile(readmePath, "utf-8");
      const readmeB = await fs.readFile(readmePathB, "utf-8");
      const readmeC = await fs.readFile(readmePathC, "utf-8");

      expect(readme.trim()).toMatchInlineSnapshot(`
        "# pkg-a

        ## 1.0.4

        ### Patch Changes

        - Hey, let's have fun with testing!"
      `);

      expect(readmeB.trim()).toMatchInlineSnapshot(`
        "# pkg-b

        ## 1.2.1

        ### Patch Changes

        - Hey, let's have fun with testing!
        - Updated dependencies
          - pkg-c@2.0.1"
      `);

      expect(readmeC.trim()).toMatchInlineSnapshot(`
        "# pkg-c

        ## 2.0.1

        ### Patch Changes

        - Hey, let's have fun with testing!"
      `);
    });
  });

  describe("should error and not write if", () => {
    // This is skipped as *for now* we are assuming we have been passed
    // valid releasePlans - this may get work done on it in the future
    it.todo("a package appears twice", async () => {
      let changedFiles;
      try {
        const testResults = await testSetup(
          {
            "package.json": JSON.stringify({
              private: true,
              workspaces: ["packages/*"],
            }),
            "package-lock.json": "",
            "packages/pkg-a/package.json": JSON.stringify({
              name: "pkg-a",
              version: "1.0.0",
            }),
          },
          {
            changesets: [
              {
                id: "quick-lions-devour",
                summary: "Hey, let's have fun with testing!",
                releases: [{ name: "pkg-a", type: "minor" }],
              },
            ],
            releases: [
              {
                name: "pkg-a",
                type: "minor",
                oldVersion: "1.0.0",
                newVersion: "1.1.0",
                changesets: ["quick-lions-devour"],
              },
              {
                name: "pkg-a",
                type: "minor",
                oldVersion: "1.0.0",
                newVersion: "1.1.0",
                changesets: ["quick-lions-devour"],
              },
            ],
            preState: undefined,
          },
        );
        changedFiles = testResults.changedFiles;
      } catch (e) {
        // eslint-disable-next-line vitest/no-conditional-expect
        expect((e as Error).message).toEqual("some string probably");

        return;
      }

      throw new Error(
        `expected error but instead got changed files: \n${changedFiles.join(
          "\n",
        )}`,
      );
    });

    it("a package cannot be found", async () => {
      const releasePlan = new FakeReleasePlan(
        [],
        [
          {
            name: "impossible-package",
            type: "minor",
            oldVersion: "1.0.0",
            newVersion: "1.0.0",
            changesets: [],
          },
        ],
      );

      const tempDir = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          dependencies: {
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
      });

      await exec("git", ["init"], { nodeOptions: { cwd: tempDir } });

      await git.add(".", tempDir);
      await git.commit("first commit", tempDir);

      try {
        const packages = await getPackages(tempDir);
        await applyReleasePlan(
          releasePlan.getReleasePlan(),
          packages,
          releasePlan.config,
        );
      } catch (e) {
        // eslint-disable-next-line vitest/no-conditional-expect
        expect((e as Error).message).toEqual(
          "Could not find matching package for release of: impossible-package",
        );

        const gitCmd = await exec("git", ["status"], {
          nodeOptions: { cwd: tempDir },
        });

        // eslint-disable-next-line vitest/no-conditional-expect
        expect(gitCmd.stdout.toString().includes("nothing to commit")).toEqual(
          true,
        );
        return;
      }

      throw new Error("Expected test to exit before this point");
    });

    it(
      "a provided changelog function fails",
      temporarilySilenceLogs(async () => {
        const releasePlan = new FakeReleasePlan();

        const tempDir = await testdir({
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        });

        await exec("git", ["init"], { nodeOptions: { cwd: tempDir } });

        await git.add(".", tempDir);
        await git.commit("first commit", tempDir);

        try {
          const packages = await getPackages(tempDir);

          await applyReleasePlan(releasePlan.getReleasePlan(), packages, {
            ...releasePlan.config,
            changelog: [
              path.resolve(
                import.meta.dirname,
                "test-utils/failing-functions.ts",
              ),
              null,
            ],
          });
        } catch (e) {
          // eslint-disable-next-line vitest/no-conditional-expect
          expect((e as Error).message).toEqual("no chance");

          const gitCmd = await exec("git", ["status"], {
            nodeOptions: { cwd: tempDir },
          });

          // eslint-disable-next-line vitest/no-conditional-expect
          expect(
            gitCmd.stdout.toString().includes("nothing to commit"),
          ).toEqual(true);
          // eslint-disable-next-line vitest/no-conditional-expect
          expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
            [
              [
                "The following error was encountered while generating changelog entries",
              ],
              [
                "We have escaped applying the changesets, and no files should have been affected",
              ],
            ]
          `);
          return;
        }

        throw new Error("Expected test to exit before this point");
      }),
    );
  });

  describe("changesets", () => {
    it("should delete one changeset after it is applied", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath!: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return outputFile(thisPath, content);
          }),
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        releasePlan.config,
        undefined,
        setupFunc,
      );

      const changesetExists = existsSync(changesetPath);
      expect(changesetExists).toEqual(false);
    });

    it("should NOT delete changesets for ignored packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath!: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return outputFile(thisPath, content);
          }),
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        { ...releasePlan.config, ignore: ["pkg-a"] },
        undefined,
        setupFunc,
      );

      const changesetExists = existsSync(changesetPath);
      expect(changesetExists).toEqual(true);
    });

    it("should NOT delete changesets for private unversioned packages", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath!: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.getReleasePlan().changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return outputFile(thisPath, content);
          }),
        );

      await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            private: true,
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          privatePackages: { version: false, tag: false },
        },
        undefined,
        setupFunc,
      );

      const changesetExists = existsSync(changesetPath);
      expect(changesetExists).toEqual(true);
    });
  });

  describe("files", () => {
    it("shouldn't commit updated files from packages", async () => {
      const releasePlan = new FakeReleasePlan();

      const { tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          commit: [changesetsCliCommitPath, null],
        },
      );

      const gitCmd = await exec("git", ["status"], {
        nodeOptions: { cwd: tempDir },
      });

      expect(gitCmd.stdout.toString()).toContain(
        "Changes not staged for commit",
      );

      expect(gitCmd.stdout.toString()).toContain(
        "modified:   packages/pkg-a/package.json",
      );

      const lastCommit = await exec("git", ["log", "-1"], {
        nodeOptions: { cwd: tempDir },
      });

      expect(lastCommit.stdout.toString()).toContain("first commit");
    });

    it("should remove applied changesets", async () => {
      const releasePlan = new FakeReleasePlan();

      let changesetPath!: string;

      const setupFunc = (tempDir: string) =>
        Promise.all(
          releasePlan.changesets.map(({ id, summary }) => {
            const thisPath = path.resolve(tempDir, ".changeset", `${id}.md`);
            changesetPath = thisPath;
            const content = `---\n---\n${summary}`;
            return outputFile(thisPath, content);
          }),
        );

      const { tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "package-lock.json": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
        },
        releasePlan.getReleasePlan(),
        {
          ...releasePlan.config,
          commit: [changesetsCliCommitPath, null],
        },
        undefined,
        setupFunc,
      );

      const changesetExists = existsSync(changesetPath);

      expect(changesetExists).toEqual(false);

      const gitCmd = await exec("git", ["status"], {
        nodeOptions: { cwd: tempDir },
      });

      const changesetsDeleted = releasePlan.changesets.reduce(
        (prev, { id }) => {
          return (
            prev &&
            gitCmd.stdout.toString().includes(`deleted:    .changeset/${id}.md`)
          );
        },
        true,
      );

      expect(releasePlan.changesets.length).toBeGreaterThan(0);
      expect(changesetsDeleted).toBe(true);
    });

    it("should include pre.json in pre-release", async () => {
      const releasePlan = new FakeReleasePlan();
      const preState: PreState = {
        mode: "pre",
        tag: "beta",
        changesets: [],
      };

      const { tempDir } = await testSetup(
        {
          "package.json": JSON.stringify({
            private: true,
            workspaces: ["packages/*"],
          }),
          "yarn.lock": "",
          "packages/pkg-a/package.json": JSON.stringify({
            name: "pkg-a",
            version: "1.0.0",
            dependencies: {
              "pkg-b": "1.0.0",
            },
          }),
          "packages/pkg-b/package.json": JSON.stringify({
            name: "pkg-b",
            version: "1.0.0",
          }),
          ".changeset/pre.json": JSON.stringify(preState),
        },
        {
          ...releasePlan.getReleasePlan(),
          preState,
        },
        {
          ...releasePlan.config,
          commit: [changesetsCliCommitPath, null],
        },
      );

      const gitCmd = await exec("git", ["status"], {
        nodeOptions: { cwd: tempDir },
      });

      expect(gitCmd.stdout.toString()).toContain(
        "modified:   .changeset/pre.json",
      );
      expect(gitCmd.stdout.toString()).toContain(
        "modified:   packages/pkg-a/package.json",
      );
    });
  });
});
