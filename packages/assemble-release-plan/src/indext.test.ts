// This is going to be mostly old fixtures that we can copy across

// import getReleaseInfo from "./";

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

function getDependentsGraph(thing: [string, Array<String>] = ["pkg-a", []]) {
  let map = new Map();

  for (let [name, depenents] of thing) {
    map.set(name, depenents);
  }
  return map;
}

function getSimpleSetup(custom) {
  return getFakeData({
    workspaces: [getWorkspace()],
    changesets: [getChangeset({ releases: [getRelease()] })],
    dependentsGraph: getDependentsGraph(),
    ...custom
  });
}

describe("get-release-info", () => {
  it("should get release info for basic setup", () => {
    throw new Error("no test");
  });
  it("should get release info with dependents", () => {
    throw new Error("no test");
  });
  it("should get release info for basic package", () => {
    throw new Error("no test");
  });
  it("should get release info for basic package", () => {
    throw new Error("no test");
  });
  it("should get release info for basic package", () => {
    throw new Error("no test");
  });
});
