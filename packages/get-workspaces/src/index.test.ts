import fixtures from "fixturez";
import path from "path";

import { getWorkspaces, Packages } from "./index";

const f = fixtures(__dirname);

// BAD CODE!!! -- Should not reach out of a monorepo package. This is only for a test.
const FIXTURE_PROJECTS: string[][] = Object.entries(
  require("../../../__fixtures__/nx-workspace-base/workspace.json").projects
).filter(([name]) => !name.startsWith("my-app"));

describe("getWorkspaces", () => {
  let cwd: string;
  let workspace: Packages;

  beforeEach(async () => {
    // cwd = await f.copy("nx-workspace-base");
    cwd = await f.copy("nx-workspace-base");
    workspace = await getWorkspaces(cwd);
  });

  it("should detect an NX workspace tool if NX is configured, and no other tool is defined", async () => {
    // The tool should show as "nx"
    expect(workspace.tool).toEqual("nx");
  });

  it("should detect all NX workspace packages", async () => {
    // There should be 2 packages
    expect(workspace.packages.length).toEqual(FIXTURE_PROJECTS.length);
    // Their dir and name should be:
    FIXTURE_PROJECTS.map(([name, projectPath], i) => {
      expect(workspace.packages[i].dir).toEqual(path.resolve(cwd, projectPath));
      expect(workspace.packages[i].packageJson.name).toEqual("@myorg/" + name);
    });
  });
});
