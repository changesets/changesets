import { randomUUID } from "node:crypto";
import { defaultConfig } from "@changesets/config";
import type { Config, VersionType } from "@changesets/types";
import { inc } from "semver";
import { beforeEach, describe, expect, it } from "vitest";
import { assembleReleasePlan } from "./index.ts";
import { FakeFullState } from "./test-utils.ts";

describe("assembleReleasePlan", () => {
  let setup: FakeFullState;

  beforeEach(() => {
    setup = new FakeFullState();

    setup.addPackage("pkg-b", "1.0.0");
    setup.addPackage("pkg-c", "1.0.0");
    setup.addPackage("pkg-d", "1.0.0");
  });

  it("should assemble plan for basic setup", () => {
    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toBe(1);
    expect(releases[0]).toEqual({
      name: "pkg-a",
      type: "patch",
      newVersion: "1.0.1",
      oldVersion: "1.0.0",
      changesets: ["strange-words-combine"],
    });
  });

  it("should assemble plan for basic setup with snapshot", () => {
    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
      {
        tag: undefined,
      },
    );

    expect(releases.length).toBe(1);
    expect(releases[0].newVersion).toMatch(/0\.0\.0-\d{14}/);
  });

  it("should assemble plan for basic setup with snapshot and tag", () => {
    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
      {
        tag: "foo",
      },
    );

    expect(releases.length).toBe(1);
    expect(releases[0].newVersion).toMatch(/0\.0\.0-foo-\d{14}/);
  });

  it("should assemble plan with multiple packages", () => {
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [
        { name: "pkg-b", type: "patch" },
        { name: "pkg-c", type: "patch" },
        { name: "pkg-d", type: "major" },
      ],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toBe(4);
    expect(releases[0].name).toBe("pkg-a");
    expect(releases[0].newVersion).toBe("1.0.1");
    expect(releases[1].name).toBe("pkg-b");
    expect(releases[1].newVersion).toBe("1.0.1");
    expect(releases[2].name).toBe("pkg-c");
    expect(releases[2].newVersion).toBe("1.0.1");
    expect(releases[3].name).toBe("pkg-d");
    expect(releases[3].newVersion).toBe("2.0.0");
  });

  it("should handle two changesets for a package", () => {
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [{ name: "pkg-a", type: "major" }],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(1);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].type).toEqual("major");
    expect(releases[0].newVersion).toEqual("2.0.0");
  });

  it("none should not override any other release types", () => {
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [
        { name: "pkg-a", type: "none" },
        { name: "pkg-b", type: "none" },
        { name: "pkg-c", type: "none" },
      ],
    });
    setup.addChangeset({
      id: "big-cats-wonder",
      releases: [
        { name: "pkg-a", type: "patch" },
        { name: "pkg-b", type: "minor" },
        { name: "pkg-c", type: "major" },
      ],
    });
    setup.addChangeset({
      id: "big-cats-yelp",
      releases: [
        { name: "pkg-a", type: "none" },
        { name: "pkg-b", type: "none" },
        { name: "pkg-c", type: "none" },
      ],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(3);

    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].type).toEqual("patch");
    expect(releases[0].newVersion).toEqual("1.0.1");

    expect(releases[1].name).toEqual("pkg-b");
    expect(releases[1].type).toEqual("minor");
    expect(releases[1].newVersion).toEqual("1.1.0");

    expect(releases[2].name).toEqual("pkg-c");
    expect(releases[2].type).toEqual("major");
    expect(releases[2].newVersion).toEqual("2.0.0");
  });

  it("should update multiple dependents of a single package", () => {
    setup.updateDependency("pkg-b", "pkg-a", "1.0.0");
    setup.updateDependency("pkg-c", "pkg-a", "1.0.0");

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(3);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].newVersion).toEqual("1.0.1");
    expect(releases[1].name).toEqual("pkg-b");
    expect(releases[1].newVersion).toEqual("1.0.1");
    expect(releases[2].name).toEqual("pkg-c");
    expect(releases[2].newVersion).toEqual("1.0.1");
  });

  it("should update dependents all the way down the dep tree", () => {
    setup.updateDependency("pkg-b", "pkg-a", "1.0.0");
    setup.updateDependency("pkg-c", "pkg-b", "1.0.0");
    setup.updateDependency("pkg-d", "pkg-c", "1.0.0");

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(4);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].newVersion).toEqual("1.0.1");
    expect(releases[1].name).toEqual("pkg-b");
    expect(releases[1].newVersion).toEqual("1.0.1");
    expect(releases[2].name).toEqual("pkg-c");
    expect(releases[2].newVersion).toEqual("1.0.1");
    expect(releases[3].name).toEqual("pkg-d");
    expect(releases[3].newVersion).toEqual("1.0.1");
  });

  it("should not bump packages with a wildcard dependency", () => {
    setup.updateDependency("pkg-b", "pkg-a", "*");
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [{ name: "pkg-a", type: "major" }],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(1);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].newVersion).toEqual("2.0.0");
  });

  it("throws error when changeset contains package that is not in workspace", () => {
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [{ name: "pkg-a", type: "major" }],
    });
    setup.addChangeset({
      id: "small-dogs-sad",
      releases: [{ name: "pkg-z", type: "minor" }],
    });

    expect(() =>
      assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      ),
    ).toThrow(
      "Found changeset small-dogs-sad for package pkg-z which is not in the workspace",
    );
  });

  describe("link: protocol", () => {
    it("should not touch link: ranges", () => {
      setup.updateDevDependency("pkg-b", "pkg-a", "link:../pkg-a");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
    });
  });

  describe("file: protocol", () => {
    it("should not touch file: ranges", () => {
      setup.updateDevDependency("pkg-b", "pkg-a", "file:../pkg-a");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
    });
  });

  describe("ignored packages", () => {
    it("does not touch ignored packages with changesets", () => {
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });
      setup.addChangeset({
        id: "small-dogs-sad",
        releases: [{ name: "pkg-b", type: "minor" }],
      });
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ignore: ["pkg-b"],
        },
        undefined,
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
    });

    it("creates 'none' releases for ignored dependencies", () => {
      setup.updateDependency("pkg-b", "pkg-a", "1.0.0");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });
      setup.addChangeset({
        id: "small-dogs-sad",
        releases: [{ name: "pkg-b", type: "minor" }],
      });
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ignore: ["pkg-b"],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].type).toEqual("none");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });

    it("creates 'none' releases for ignored peerDependencies", () => {
      setup.updatePeerDependency("pkg-b", "pkg-a", "1.0.0");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });
      setup.addChangeset({
        id: "small-dogs-sad",
        releases: [{ name: "pkg-b", type: "minor" }],
      });
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ignore: ["pkg-b"],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].type).toEqual("none");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });

    it("creates 'none' releases for ignored devDependencies", () => {
      setup.updateDevDependency("pkg-b", "pkg-a", "1.0.0");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });
      setup.addChangeset({
        id: "small-dogs-sad",
        releases: [{ name: "pkg-b", type: "minor" }],
      });
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ignore: ["pkg-b"],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].type).toEqual("none");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });

    it("should throw if changeset includes both ignored and non-ignored packages", () => {
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [
          { name: "pkg-a", type: "major" },
          { name: "pkg-b", type: "minor" },
        ],
      });

      expect(() =>
        assembleReleasePlan(
          setup.changesets,
          setup.packages,
          {
            ...defaultConfig,
            ignore: ["pkg-b"],
          },
          undefined,
        ),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Found mixed changeset big-cats-delight
        Found ignored packages: pkg-b
        Found not ignored packages: pkg-a
        Mixed changesets that contain both ignored and not ignored packages are not allowed]
      `);
    });
  });

  describe("fixed packages", () => {
    it("should bump all fixed packages together", () => {
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [{ name: "pkg-a", type: "minor" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [["pkg-a", "pkg-b"]],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].newVersion).toEqual("1.1.0");
      expect(releases[1].newVersion).toEqual("1.1.0");
    });

    it("should bump versions when the version is determined by an unreleased package", () => {
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [
          { name: "pkg-b", type: "minor" },
          { name: "pkg-a", type: "patch" },
        ],
      });

      setup.updatePackage("pkg-c", "2.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [["pkg-a", "pkg-b", "pkg-c"]],
        },
        undefined,
      );

      expect(releases.length).toEqual(3);
      expect(releases[0].newVersion).toEqual("2.1.0");
      expect(releases[1].newVersion).toEqual("2.1.0");
      expect(releases[2].newVersion).toEqual("2.1.0");
    });

    it("should bump multiple fixed groups in a chain when one depends on another", () => {
      // Expected events:
      // - dependencies are checked, nothing leaves semver, nothing changes
      // - fixed are checked, pkg-a is aligned with pkg-b
      // - dependencies are checked, in pkg-c the dependency range for pkg-a is not satisfied, so a patch bump is given to it
      // - fixed are checked, pkg-c is aligned with pkg-d
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [{ name: "pkg-b", type: "major" }],
      });
      setup.addChangeset({
        id: "totally-average-verbiage",
        releases: [{ name: "pkg-d", type: "minor" }],
      });

      setup.updateDependency("pkg-c", "pkg-a", "^1.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        },
        undefined,
      );

      expect(releases.length).toEqual(4);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].newVersion).toEqual("2.0.0");
      expect(releases[2].name).toEqual("pkg-d");
      expect(releases[2].newVersion).toEqual("1.1.0");
      expect(releases[3].name).toEqual("pkg-c");
      expect(releases[3].newVersion).toEqual("1.1.0");
    });

    it("should bump multiple fixed groups in a chain when one depends on another 2", () => {
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [{ name: "pkg-a", type: "major" }],
      });
      setup.addChangeset({
        id: "totally-average-verbiage",
        releases: [{ name: "pkg-d", type: "minor" }],
      });

      setup.updateDependency("pkg-c", "pkg-b", "^1.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        },
        undefined,
      );

      expect(releases.length).toEqual(4);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-d");
      expect(releases[1].newVersion).toEqual("1.1.0");
      expect(releases[2].name).toEqual("pkg-b");
      expect(releases[2].newVersion).toEqual("2.0.0");
      expect(releases[3].name).toEqual("pkg-c");
      expect(releases[3].newVersion).toEqual("1.1.0");
    });

    it("should return an empty release array when no changes will occur", () => {
      const { releases } = assembleReleasePlan(
        [],
        setup.packages,
        {
          ...defaultConfig,
          fixed: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        },
        undefined,
      );

      expect(releases).toEqual([]);
    });

    it("should bump peer dependents where the version is updated because of fixed", () => {
      setup.updatePeerDependency("pkg-b", "pkg-c", "1.0.0");

      setup.addChangeset({
        id: "some-id",
        releases: [{ type: "minor", name: "pkg-a" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [["pkg-a", "pkg-c"]],
        },
        undefined,
      );

      expect(releases).toMatchObject([
        {
          name: "pkg-a",
          newVersion: "1.1.0",
        },
        {
          name: "pkg-c",
          newVersion: "1.1.0",
        },
        {
          name: "pkg-b",
          newVersion: "1.0.1",
        },
      ]);
    });
  });

  describe("linked packages", () => {
    it("should bump linked packages together", () => {
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [{ name: "pkg-b", type: "major" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          linked: [["pkg-a", "pkg-b"]],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].newVersion).toEqual("2.0.0");
    });

    it("should bump versions when the version is determined by an unreleased package", () => {
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [
          { name: "pkg-b", type: "minor" },
          { name: "pkg-a", type: "patch" },
        ],
      });

      setup.updatePackage("pkg-c", "2.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          linked: [["pkg-a", "pkg-b", "pkg-c"]],
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].newVersion).toEqual("2.1.0");
      expect(releases[1].newVersion).toEqual("2.1.0");
    });

    it("should bump multiple linked groups in a chain when one depends on another", () => {
      /*
      Expected events:
      - dependencies are checked, nothing leaves semver, nothing changes
      - linked are checked, pkg-a is aligned with pkg-b
      - dependencies are checked, pkg-c is now outside its dependency on pkg-a, and is given a patch
      - linked is checked, pkg-c is aligned with pkg-d
    */
      setup.addChangeset({
        id: "just-some-umbrellas",
        releases: [{ name: "pkg-b", type: "major" }],
      });
      setup.addChangeset({
        id: "totally-average-verbiage",
        releases: [{ name: "pkg-d", type: "minor" }],
      });

      setup.updateDependency("pkg-c", "pkg-a", "^1.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          linked: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        },
        undefined,
      );

      expect(releases.length).toEqual(4);
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].newVersion).toEqual("2.0.0");
      expect(releases[2].newVersion).toEqual("1.1.0");
      expect(releases[3].newVersion).toEqual("1.1.0");
    });

    it("should return an empty release array when no changes will occur", () => {
      const { releases } = assembleReleasePlan(
        [],
        setup.packages,
        {
          ...defaultConfig,
          linked: [
            ["pkg-a", "pkg-b"],
            ["pkg-c", "pkg-d"],
          ],
        },
        undefined,
      );

      expect(releases).toEqual([]);
    });

    it("should bump peer dependents where the version is updated because of linked", () => {
      setup.updatePeerDependency("pkg-b", "pkg-a", "1.0.0");

      setup.addChangeset({
        id: "some-id",
        releases: [{ type: "minor", name: "pkg-c" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          linked: [["pkg-a", "pkg-c"]],
        },
        undefined,
      );

      expect(releases).toMatchObject([
        {
          name: "pkg-a",
          newVersion: "1.1.0",
        },
        {
          name: "pkg-c",
          newVersion: "1.1.0",
        },
        {
          name: "pkg-b",
          newVersion: "1.0.1",
        },
      ]);
    });

    // https://github.com/changesets/changesets/issues/963
    // https://github.com/changesets/changesets/issues/1759
    it("should not bump fixed packages due to peer dependents", () => {
      const setup = new FakeFullState({ changesets: [] });

      setup.addPackage("@ex/core", "0.1.0");
      setup.addPackage("@ex/errors", "0.1.0");
      setup.addPackage("@ex/api", "0.1.0");
      setup.addPackage("some-peer", "0.1.0"); // optional peer
      setup.addPackage("@ex/components", "0.1.0");

      setup.updateDependencies("@ex/api", [
        { name: "@ex/core", range: "0.1.0" },
        { name: "@ex/errors", range: "0.1.0" },
        { name: "some-peer", range: "0.1.0", type: "peer" },
      ]);
      setup.updateDependencies("@ex/components", [
        { name: "@ex/api", range: "0.1.0" },
        { name: "some-peer", range: "0.1.0" },
      ]);

      setup.addChangeset({ releases: [{ name: "@ex/core", type: "minor" }] });

      const result = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          fixed: [
            [
              "@ex/core",
              "@ex/errors",
              "@ex/api",
              "some-peer",
              "@ex/components",
            ],
          ],
        },
        undefined,
      );

      expect(result.releases).toHaveLength(5);
      expect(
        result.releases.every((release) => release.newVersion === "0.2.0"),
        "every bump should be to 0.2.0",
      ).toBe(true);
    });
  });

  describe("pre mode", () => {
    it("should not generate a release for package that has no changesets and is not a dependent of any packages being released when exiting pre mode", () => {
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
        },
        {
          changesets: [],
          tag: "next",
          mode: "exit",
        },
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.1");
    });

    it("should bump dev dependents when exiting pre-release mode", () => {
      setup.updatePackage("pkg-a", "1.0.1-next.0");
      setup.updatePackage("pkg-b", "1.0.1-next.0");
      setup.updateDevDependency("pkg-b", "pkg-a", "1.0.1-next.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
        },
        {
          changesets: ["strange-words-combine"],
          tag: "next",
          mode: "exit",
        },
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.1");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].newVersion).toEqual("1.0.1");
    });

    it("should not bump ignored dev dependents when exiting pre-release mode", () => {
      setup.updatePackage("pkg-a", "1.0.1-next.0");
      setup.updatePackage("pkg-b", "1.0.1-next.0");
      setup.updateDevDependency("pkg-b", "pkg-a", "1.0.1-next.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ignore: ["pkg-b"],
        },
        {
          changesets: ["strange-words-combine"],
          tag: "next",
          mode: "exit",
        },
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.1");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].newVersion).toEqual("1.0.1-next.0");
    });

    it("should return a release with the highest bump type within the current release despite of having a higher release among previous prereleases", () => {
      // previous release
      setup.addChangeset({
        id: "major-bumping-one",
        releases: [
          {
            name: "pkg-a",
            type: "major",
          },
        ],
      });
      setup.updatePackage("pkg-a", "2.0.0-next.0");

      // current release
      setup.addChangeset({
        id: "minor-bumping-one",
        releases: [
          {
            name: "pkg-a",
            type: "minor",
          },
        ],
      });
      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
        },
        {
          changesets: ["major-bumping-one"],
          tag: "next",
          mode: "pre",
        },
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0-next.1");
      expect(releases[0].type).toEqual("minor");
    });
  });

  describe("workspace protocol", () => {
    // (workspace:path patch) => 1.0.1
    it("should assemble plan with workspace:path dependencies", () => {
      setup.updateDependency("pkg-b", "pkg-a", "workspace:packages/pkg-a");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].oldVersion).toEqual("1.0.0");
      expect(releases[1].newVersion).toEqual("1.0.1");
    });
  });

  describe("bumpVersionsWithWorkspaceProtocolOnly", () => {
    it("should only bump packages with workspace protocol", () => {
      setup.updateDependency("pkg-b", "pkg-a", "^1.0.0");
      setup.updateDependency("pkg-c", "pkg-a", "workspace:^1.0.0");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          bumpVersionsWithWorkspaceProtocolOnly: true,
        },
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");
      expect(releases[1].name).toEqual("pkg-c");
      expect(releases[1].newVersion).toEqual("1.0.1");
      expect(releases[1].changesets).toEqual([]);
    });

    it("should bump packages with workspace:^ and workspace:~ ranges", () => {
      setup.updateDependency("pkg-b", "pkg-a", "workspace:~");
      setup.updateDependency("pkg-c", "pkg-a", "workspace:^");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-a", type: "major" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          bumpVersionsWithWorkspaceProtocolOnly: true,
        },
        undefined,
      );

      expect(releases.length).toEqual(3);

      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("2.0.0");

      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].newVersion).toEqual("1.0.1");
      expect(releases[1].changesets).toEqual([]);

      expect(releases[2].name).toEqual("pkg-c");
      expect(releases[2].newVersion).toEqual("1.0.1");
      expect(releases[2].changesets).toEqual([]);
    });
  });

  describe("updateInternalDependents: always", () => {
    it("should bump a transitive dependent when a dependency package gets bumped", () => {
      setup.updateDependency("pkg-b", "pkg-a", "^1.0.0");
      setup.updateDependency("pkg-c", "pkg-b", "^1.0.0");

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
            updateInternalDependents: "always",
          },
        },
        undefined,
      );

      expect(releases.length).toBe(3);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.1");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].newVersion).toEqual("1.0.1");
      expect(releases[2].name).toEqual("pkg-c");
      expect(releases[2].newVersion).toEqual("1.0.1");
    });

    it("not bump a dependent package when a dependency has `none` changeset", () => {
      setup.updateDependency("pkg-b", "pkg-c", "^1.0.0");
      setup.addChangeset({
        id: "stuff-and-nonsense",
        releases: [{ name: "pkg-c", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        {
          ...defaultConfig,
          ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
            ...defaultConfig.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
            updateInternalDependents: "always",
          },
        },
        undefined,
      );

      expect(releases.length).toBe(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.1");
      expect(releases[1].name).toEqual("pkg-c");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });
  });
});

describe("dependent bumping", () => {
  type DeepPartial<T> = T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;

  /** Semver range prefix written on the dependency. */
  type Range = "^" | "~" | "=";
  /** Which field the dependency lives in. */
  type DepKind = "dep" | "dev" | "peer";

  const RANGES = ["^", "~", "="] as const satisfies readonly Range[];
  const DEP_KINDS = [
    "dep",
    "dev",
    "peer",
  ] as const satisfies readonly DepKind[];
  const BUMPS = [
    "none",
    "patch",
    "minor",
    "major",
  ] as const satisfies readonly VersionType[];
  const BASE_VERSION = "1.0.0";

  // ---- Expectation tables ----
  //
  // The whole matrix lives in one readable table, indexed `expected[dep][bump][range]`.
  // The value is the resulting version of the *dependent* (`pkg-a`);

  type ExpectationTable = Record<
    DepKind,
    Record<VersionType, Record<Range, string>>
  >;

  const defaultBumps: ExpectationTable[DepKind] = {
    none: { "^": "1.0.0", "~": "1.0.0", "=": "1.0.0" },
    patch: { "^": "1.0.0", "~": "1.0.0", "=": "1.0.1" },
    minor: { "^": "1.0.0", "~": "1.0.1", "=": "1.0.1" },
    major: { "^": "1.0.1", "~": "1.0.1", "=": "1.0.1" },
  };

  // oxfmt-ignore
  const baseExpectations: ExpectationTable = {
    // direct and peer dependents have to be bumped only when dependency falls out of allowed range
    // otherwise, installing the latest versions of dependent and dependency would result in duplicate dependency package in the tree
    dep: defaultBumps,
    peer: defaultBumps,
    // devDependent should stay untouched, given the dev dependency doesn't affect production installations
    dev: {
      none:  { "^": "1.0.0", "~": "1.0.0", "=": "1.0.0" },
      patch: { "^": "1.0.0", "~": "1.0.0", "=": "1.0.0" },
      minor: { "^": "1.0.0", "~": "1.0.0", "=": "1.0.0" },
      major: { "^": "1.0.0", "~": "1.0.0", "=": "1.0.0" },
    },
  };

  // ---- Test cases ----

  type Case = {
    range: Range;
    dep: DepKind;
    bump: VersionType;
    /** Expected resulting version of the dependent (`pkg-a`). */
    expected: string;
    /** Set when an override changed the baseline expectation (for the title). */
    overriddenFrom?: string;
  };

  /** Flattens the expectation table into one `Case` per cell. */
  function casesFromTable(table: ExpectationTable): Case[] {
    return DEP_KINDS.flatMap((dep) =>
      BUMPS.flatMap((bump) =>
        RANGES.map((range) => ({
          dep,
          bump,
          range,
          expected: table[dep][bump][range],
        })),
      ),
    );
  }

  /**
   * Applies a partial expectation table on top of the baseline cases.
   * Only the cells you list change; everything else stays at the baseline.
   * Invalid keys are caught by the type checker, so there's no runtime
   * "no matching case" guard to maintain.
   */
  function applyOverrides(
    cases: Case[],
    overrides: DeepPartial<ExpectationTable>,
  ): Case[] {
    return cases.map((c) => {
      const expected = overrides[c.dep]?.[c.bump]?.[c.range];
      if (expected == null) return c;

      if (expected === c.expected) {
        throw new Error(
          `Override for ${c.range}${c.dep}:${c.bump} is invalid. ${expected} is same as original value.`,
        );
      }

      return { ...c, expected, overriddenFrom: c.expected };
    });
  }

  // ---- Execution ----

  /** Turns a canonical range into the string written to package.json. */
  type RangeRenderer = (range: Range) => string;

  const defaultRange: RangeRenderer = (range) =>
    range === "=" ? BASE_VERSION : `${range}${BASE_VERSION}`;

  // oxfmt-ignore
  const writeDependency: Record<DepKind, (setup: FakeFullState, range: string) => void> = {
    dep: (setup, range) =>
      setup.updateDependency("pkg-a", "pkg-a-b", range),
    dev: (setup, range) =>
      setup.updateDevDependency("pkg-a", "pkg-a-b", range),
    peer: (setup, range) =>
      setup.updatePeerDependency("pkg-a", "pkg-a-b", range),
  };

  function runCase(c: Case, config: Config, renderRange: RangeRenderer) {
    /*
     * Set up the test "workspace":
     *   - `pkg-a` depends on `pkg-a-b` via dependency kind `dep`
     *     using the range produced by `renderRange(range)`
     *   - `pkg-a-b` is bumped by `bump`
     */
    const setup = new FakeFullState({ changesets: [] });
    setup.addPackage("pkg-a-b", BASE_VERSION);
    setup.addChangeset({
      id: randomUUID(),
      releases: [{ name: "pkg-a-b", type: c.bump }],
    });
    writeDependency[c.dep](setup, renderRange(c.range));

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      config,
      undefined,
    );

    // Sanity check: the dependency itself bumped as requested.
    const dependency = releases.find((r) => r.name === "pkg-a-b");
    expect(dependency).toBeDefined();
    expect(dependency!.newVersion).toEqual(
      c.bump !== "none" ? inc(BASE_VERSION, c.bump) : BASE_VERSION,
    );

    // The dependent got bumped (or not) as expected.
    const dependent = releases.find((r) => r.name === "pkg-a");
    if (c.expected === BASE_VERSION) {
      expect(dependent?.newVersion).toBeOneOf(["1.0.0", undefined]);
    } else {
      expect(dependent?.newVersion).toEqual(c.expected);
    }
  }

  // ---- Suite builder ----

  function fieldWidths(cases: Case[]) {
    return {
      range: Math.max(...cases.map((c) => c.range.length)),
      dep: Math.max(...cases.map((c) => c.dep.length)),
      bump: Math.max(...cases.map((c) => c.bump.length)),
    };
  }

  function caseTitle(c: Case, widths: ReturnType<typeof fieldWidths>): string {
    const range = c.range.padEnd(widths.range);
    const dep = c.dep.padStart(widths.dep);
    const bump = c.bump.padEnd(widths.bump);

    let title = `(${range} ${dep} ${bump}) => ${c.expected}`;
    if (c.overriddenFrom != null) {
      title += ` (overridden from ${c.overriddenFrom})`;
    }
    return title;
  }

  type SuiteOptions = {
    config?: DeepPartial<Config>;
    overrides?: DeepPartial<ExpectationTable>;
    /** Override how the range is written (e.g. the `workspace:` protocol). */
    renderRange?: RangeRenderer;
  };

  function describeDependentBumping(
    name: string,
    {
      config = {},
      overrides = {},
      renderRange = defaultRange,
    }: SuiteOptions = {},
  ) {
    const mergedConfig = {
      ...defaultConfig,
      ...config,
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        ...defaultConfig?.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
        ...config?.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH,
      },
    } as Config;
    const cases = applyOverrides(casesFromTable(baseExpectations), overrides);
    const widths = fieldWidths(cases);

    // eslint-disable-next-line vitest/valid-title
    describe(name, () => {
      for (const testCase of cases) {
        // eslint-disable-next-line vitest/valid-title, vitest/expect-expect
        it(caseTitle(testCase, widths), () => {
          runCase(testCase, mergedConfig, renderRange);
        });
      }
    });
  }

  // ---- Suites ----

  describeDependentBumping("default config");

  // makes all non-none bumps result in a patch bump of a dependent
  describeDependentBumping("updateInternalDependents: always", {
    config: {
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        updateInternalDependents: "always",
      },
    },
    overrides: {
      dep: {
        patch: { "^": "1.0.1", "~": "1.0.1" },
        minor: { "^": "1.0.1" },
      },
      peer: {
        patch: { "^": "1.0.1", "~": "1.0.1" },
        minor: { "^": "1.0.1" },
      },
    },
  });

  // should not affect dependent bumps
  describeDependentBumping("onlyUpdatePeerDependentsWhenOutOfRange: true", {
    config: {
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange: true,
      },
    },
  });

  // weird case, should probably not be allowed
  describeDependentBumping(
    "onlyUpdatePeerDependentsWhenOutOfRange + updateInternalDependents combined",
    {
      config: {
        ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
          onlyUpdatePeerDependentsWhenOutOfRange: true,
          updateInternalDependents: "always",
        },
      },
      overrides: {
        dep: {
          patch: { "^": "1.0.1", "~": "1.0.1" },
          minor: { "^": "1.0.1" },
        },
        peer: {
          patch: { "^": "1.0.1", "~": "1.0.1" },
          minor: { "^": "1.0.1" },
        },
      },
    },
  );

  describe("workspace: protocol works the same as without it", () => {
    describeDependentBumping("modifier only", {
      // render workspace:*, workspace:^, workspace:~
      renderRange: (range) => `workspace:${range !== "=" ? range : "*"}`,
    });

    describeDependentBumping("modifier+version", {
      // render workspace:1.0.0, workspace:^1.0.0, workspace:~1.0.0
      renderRange: (range) => `workspace:${range !== "=" ? range : ""}1.0.0`,
    });
  });

  it("should assemble plan when dependent has both a changed prod and dev dependency", () => {
    const setup = new FakeFullState({ changesets: [] });
    setup.addPackage("pkg-b", "1.0.0");
    setup.addPackage("pkg-c", "1.0.0");
    setup.updateDevDependency("pkg-b", "pkg-a", "^1.0.0");
    setup.updateDependency("pkg-b", "pkg-c", "^1.0.0");
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [
        { name: "pkg-a", type: "major" },
        { name: "pkg-c", type: "major" },
      ],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases.length).toEqual(3);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].newVersion).toEqual("2.0.0");
    expect(releases[1].name).toEqual("pkg-c");
    expect(releases[1].newVersion).toEqual("2.0.0");
    expect(releases[2].name).toEqual("pkg-b");
    expect(releases[2].oldVersion).toEqual("1.0.0");
    expect(releases[2].newVersion).toEqual("1.0.1");
  });

  describe("changetype none", () => {
    it("should assemble no-op plan when dependent has a changeset type of none", () => {
      const setup = new FakeFullState({ changesets: [] });
      setup.addPackage("pkg-b", "1.0.0");
      setup.addPackage("pkg-c", "1.0.0");
      setup.updateDependency("pkg-c", "pkg-b", "^1.0.0");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-b", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(1);
      expect(releases[0].name).toEqual("pkg-b");
      expect(releases[0].oldVersion).toEqual("1.0.0");
      expect(releases[0].newVersion).toEqual("1.0.0");
    });

    // (~ peer | none) => none
    it("should not bump dependent when bumping peer:~ by none", () => {
      const setup = new FakeFullState({ changesets: [] });
      setup.addPackage("pkg-b", "1.0.0");
      setup.updatePeerDependency("pkg-b", "pkg-a", "~1.0.0");
      setup.addChangeset({
        id: "anyway-the-windblows",
        releases: [{ name: "pkg-a", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toBe(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.0");
    });

    // (^ peer none) => none
    it("should not bump dependent when bumping peer:^ by none", () => {
      const setup = new FakeFullState({ changesets: [] });
      setup.addPackage("pkg-b", "1.0.0");
      setup.updatePeerDependency("pkg-b", "pkg-a", "^1.0.0");
      setup.addChangeset({
        id: "anyway-the-windblows",
        releases: [{ name: "pkg-a", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toBe(1);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[0].newVersion).toEqual("1.0.0");
    });

    // (workspace:^ direct none) => same
    it("should not bump dependent when bumping dep:workspace:^ by none", () => {
      const setup = new FakeFullState();
      setup.addPackage("pkg-b", "1.0.0");
      setup.addPackage("pkg-c", "1.0.0");
      setup.updateDependency("pkg-c", "pkg-b", "workspace:*");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-b", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].oldVersion).toEqual("1.0.0");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });

    // (workspace:path direct none) => same
    it("should not bump dependent when bumping dep:workspace:path by none", () => {
      const setup = new FakeFullState();
      setup.addPackage("pkg-b", "1.0.0");
      setup.addPackage("pkg-c", "1.0.0");
      setup.updateDependency("pkg-c", "pkg-b", "workspace:packages/pkg-b");
      setup.addChangeset({
        id: "big-cats-delight",
        releases: [{ name: "pkg-b", type: "none" }],
      });

      const { releases } = assembleReleasePlan(
        setup.changesets,
        setup.packages,
        defaultConfig,
        undefined,
      );

      expect(releases.length).toEqual(2);
      expect(releases[0].name).toEqual("pkg-a");
      expect(releases[1].name).toEqual("pkg-b");
      expect(releases[1].oldVersion).toEqual("1.0.0");
      expect(releases[1].newVersion).toEqual("1.0.0");
    });
  });
});
