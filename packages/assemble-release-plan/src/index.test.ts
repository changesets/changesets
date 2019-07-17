// This is going to be mostly old fixtures that we can copy across

// import getReleaseInfo from "./";

import {
  NewChangeset,
  Workspace,
  Config,
  Release,
  VersionType
} from "@changesets/types";

import assembleReleasePlan from "./";

function getFakeData(
  data: {
    changesets?: NewChangeset[];
    workspaces?: Workspace[];
    dependentsGraph?: Map<string, string[]>;
    config?: Config;
  } = {}
) {
  let changesets = data.changesets || [];
  let workspaces = data.workspaces || [];
  let dependentsGraph = data.dependentsGraph || new Map();
  let config = data.config || {};

  return {
    changesets,
    workspaces,
    dependentsGraph,
    config
  };
}

function getWorkspace(
  name: string = "pkg-a",
  version: string = "1.0.0"
): Workspace {
  return {
    name,
    config: {
      name,
      version
    },
    dir: "this-shouldn't-matter"
  };
}

function getChangeset(
  data: {
    id?: string;
    summary?: string;
    releases?: Array<Release>;
  } = {}
): NewChangeset {
  let id = data.id || "strange-words-combine";
  let summary = data.summary || "base summary whatever";
  let releases = data.releases || [];
  return {
    id,
    summary,
    releases
  };
}

function getRelease(data: { name?: string; type?: VersionType } = {}): Release {
  let name = data.name || "pkg-a";
  let type = data.type || "patch";

  return { name, type };
}

function getDependentsGraph(
  thing: [[string, Array<String>]] = [["pkg-a", []]]
) {
  let map = new Map();
  for (let acity of thing) {
    let [name, depenents] = acity;
    map.set(name, depenents);
  }
  return map;
}

function getSimpleSetup(
  custom: {
    workspaces?: Workspace[];
    changesets?: NewChangeset[];
    dependentsGraph?: Map<string, string[]>;
  } = {}
) {
  return getFakeData({
    workspaces: [getWorkspace()],
    changesets: [getChangeset({ releases: [getRelease()] })],
    dependentsGraph: getDependentsGraph(),
    ...custom
  });
}

class FakeFullState {
  workspaces: Workspace[];
  changesets: NewChangeset[];
  dependentsGraph: Map<string, string[]>;

  constructor(custom?: {
    workspaces?: Workspace[];
    changesets?: NewChangeset[];
    dependentsGraph?: Map<string, string[]>;
  }) {
    let { workspaces, changesets, dependentsGraph } = getSimpleSetup(custom);
    this.workspaces = workspaces;
    this.changesets = changesets;
    this.dependentsGraph = dependentsGraph;
  }

  addChangeset(
    data: {
      id?: string;
      summary?: string;
      releases?: Array<Release>;
    } = {}
  ) {
    let changeset = getChangeset(data);
    if (this.changesets.find(c => c.id === changeset.id)) {
      throw new Error(
        `tried to add a second changeset with same id: ${changeset.id}`
      );
    }
    this.changesets.push(changeset);
  }

  updateDependency(pkgA: string, pkgB: string, version: string) {
    let ws = this.workspaces.find(a => a.name === pkgA);
    if (!ws) throw new Error("no ws");
    if (!ws.config.dependencies) ws.config.dependencies = {};
    ws.config.dependencies[pkgB] = version;

    let depList = this.dependentsGraph.get(pkgB);
    if (!depList) throw new Error("could not add dependency");
    this.dependentsGraph.set(pkgB, [...depList, pkgA]);
  }

  addWorkspace(name: string, version: string) {
    let ws = getWorkspace(name, version);
    if (this.workspaces.find(c => c.name === ws.name)) {
      throw new Error(
        `tried to add a second workspace with same name': ${ws.name}`
      );
    }
    this.workspaces.push(ws);
    this.dependentsGraph.set(name, []);
  }
  updateWorkspace(name: string, version: string) {
    let ws = this.workspaces.find(c => c.name === name);
    if (!ws) {
      throw new Error(
        `could not update workspace ${name} because it doesn't exist - try addWorskpace`
      );
    }
    ws.config.version = version;
  }
}

describe("get-release-info", () => {
  it("should get release info for basic setup", async () => {
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
  it("should get release with multiple packages", async () => {
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

  it("should get release info with dependents", async () => {
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
});
