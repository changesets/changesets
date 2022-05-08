import fixtures from "fixturez";

import { getWorkspaces, Packages } from "./index";

const f = fixtures(__dirname);

describe("getWorkspaces", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await f.copy("nx-workspace-base");
  });

  it("should detect all NX workspace packages", async () => {
    let packages: Packages;

    try {
      packages = await getWorkspaces(cwd);
    } catch (e) {
      // ignore errors.
    }

    // The tool should show as "nx"
    expect(packages.tool).toEqual("nx");
    // There should be 4 packages
    expect(packages.packages.length).toEqual(4);
    // They should look like this
    expect(packages.packages).toEqual([
      "PackageObjectA",
      "PackageObjectB",
      "PackageObjectC",
      "PackageObjectD"
    ]);
  });
});
