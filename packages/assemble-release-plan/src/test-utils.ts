import {
  NewChangeset,
  Workspace,
  Config,
  Release,
  VersionType
} from "@changesets/types";

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
  updatePeerDep(pkgA: string, pkgB: string, version: string) {
    let ws = this.workspaces.find(a => a.name === pkgA);
    if (!ws) throw new Error("no ws");
    if (!ws.config.peerDependencies) ws.config.peerDependencies = {};
    ws.config.peerDependencies[pkgB] = version;

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

export default FakeFullState;
