import fs from "fs-extra";
import path from "path";
import { getPackages, Package, Tool } from "@manypkg/get-packages";

type WorkspaceTool = Tool | "nx";

// Other than extending a new enum on "Tool", we are keeping the exact same type.
export type Packages = {
  tool: WorkspaceTool;
  packages: Package[];
  root: Package;
};

export const getWorkspaces = async (cwd: string): Promise<Packages> => {
  const { tool: manyTool, packages: manyPackages, root } = await getPackages(
    cwd
  );

  // Only treat as an NX workspace if getPackages does not find any other monorepo
  // configuration ("root"), as NX is compatible with using other monorepo tools
  // and those will take precedence over NX configured packages. We may want/need
  // to change this in the future and always treat an NX monorepo as an NX monorepo,
  // even if there is another tool configured.
  const isNX =
    manyTool === "root" && fs.existsSync(path.resolve(cwd, "nx.json"));

  if (isNX) {
    // Do the NX devkit commands to get packages here and map over the
    // output to create Package typed objects.
  }

  return {
    tool: isNX ? "nx" : manyTool,
    packages: manyPackages,
    root
  };
};

export { Package };
