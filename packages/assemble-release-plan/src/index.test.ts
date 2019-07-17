import assembleReleasePlan from "./";

import FakeFullState from "./test-utils";

describe("assemble-release-plan", () => {
  it("should assemble release plan for basic setup", async () => {
    let setup = new FakeFullState();

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      {}
    );

    expect(releases.length).toBe(1);
    expect(releases[0]).toEqual({
      name: "pkg-a",
      type: "patch",
      newVersion: "1.0.1",
      oldVersion: "1.0.0",
      changesets: ["strange-words-combine"]
    });
  });
  it("should assemble release plan with multiple packages", async () => {
    let setup = new FakeFullState();
    setup.addWorkspace("pkg-b", "1.0.0");
    setup.addWorkspace("pkg-c", "1.0.0");
    setup.addWorkspace("pkg-d", "1.0.0");

    setup.addChangeset({
      id: "big-cats-delight",
      releases: [
        { name: "pkg-b", type: "patch" },
        { name: "pkg-c", type: "patch" },
        { name: "pkg-d", type: "major" }
      ]
    });

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      {}
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
  it("should handle two changesets for a package", async () => {
    let setup = new FakeFullState();
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [{ name: "pkg-a", type: "major" }]
    });

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      {}
    );

    expect(releases.length).toEqual(1);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].type).toEqual("major");
    expect(releases[0].newVersion).toEqual("2.0.0");
  });
  it("should assemble release plan with dependents", async () => {
    let setup = new FakeFullState();
    setup.addWorkspace("pkg-b", "1.0.0");
    setup.updateDependency("pkg-b", "pkg-a", "^1.0.0");
    setup.addChangeset({
      id: "big-cats-delight",
      releases: [{ name: "pkg-a", type: "major" }]
    });

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      {}
    );

    expect(releases.length).toEqual(2);
    expect(releases[0].name).toEqual("pkg-a");
    expect(releases[0].newVersion).toEqual("2.0.0");
    expect(releases[1].name).toEqual("pkg-b");
    expect(releases[1].newVersion).toEqual("1.0.1");
    expect(releases[1].changesets).toEqual([]);
  });
  it("should assemble release plan for linked packages", () => {
    let setup = new FakeFullState();
    setup.addWorkspace("pkg-b", "1.0.0");
    setup.addChangeset({
      id: "just-some-umbrellas",
      releases: [{ name: "pkg-b", type: "major" }]
    });

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      { linked: [["pkg-a", "pkg-b"]] }
    );

    expect(releases.length).toEqual(2);
    expect(releases[0].newVersion).toEqual("2.0.0");
    expect(releases[1].newVersion).toEqual("2.0.0");
  });
  it.only("should assemble release plan where a link causes a dependency to need changing which causes a second link to update", () => {
    /*
      Expected events:
      - dependencies are checked, nothing leaves semver, nothing changes
      - linked are checked, pkg-a is aligned with pkg-b
      - depencencies are checked, pkg-c is now outside its dependency on pkg-a, and is given a patch
      - linked is checked, pkg-c is aligned with pkg-d
    */
    let setup = new FakeFullState();
    setup.addWorkspace("pkg-b", "1.0.0");
    setup.addWorkspace("pkg-c", "1.0.0");
    setup.addWorkspace("pkg-d", "1.0.0");
    setup.addChangeset({
      id: "just-some-umbrellas",
      releases: [{ name: "pkg-b", type: "major" }]
    });
    setup.addChangeset({
      id: "totally-average-verbiage",
      releases: [{ name: "pkg-d", type: "minor" }]
    });

    setup.updateDependency("pkg-c", "pkg-a", "^1.0.0");

    let { releases } = assembleReleasePlan(
      setup.changesets,
      setup.workspaces,
      setup.dependentsGraph,
      { linked: [["pkg-a", "pkg-b"], ["pkg-c", "pkg-d"]] }
    );

    expect(releases.length).toEqual(4);
    expect(releases[0].newVersion).toEqual("2.0.0");
    expect(releases[1].newVersion).toEqual("2.0.0");
    expect(releases[2].newVersion).toEqual("1.1.0");
    expect(releases[3].newVersion).toEqual("1.1.0");
  });
});
