import fs from "fs-extra";
import path from "path";
import { Workspaces } from "@nrwl/devkit";
import { getPackages, Package, Tool } from "@manypkg/get-packages";

type WorkspaceTool = Tool | "nx";

// Other than extending a new enum on "Tool", we are keeping the exact same type.
export type Packages = {
  tool: WorkspaceTool;
  packages: Package[];
  root: Package;
};

const getValuesFromPackageFile = async (dir: string): Promise<Package> => {
  const packageJsonPath = path.resolve(dir, "package.json");

  const data = await fs.promises.readFile(packageJsonPath);
  const { name, version, dependencies } = JSON.parse(data.toString());

  return {
    dir,
    packageJson: {
      dependencies,
      name,
      version
    }
  };
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

  if (!isNX) {
    return {
      tool: manyTool,
      packages: manyPackages,
      root
    };
  }

  // We are using native NX tools to read packages available instead of using
  // workspace.json alone as there are multiple ways to configure NX workspaces
  const { projects } = new Workspaces(cwd).readWorkspaceConfiguration();

  const projectRoots = Object.values(projects).map(({ root }) => root);

  let nxPackages = [];
  for (let projectRoot of projectRoots) {
    const packageDir = path.resolve(cwd, projectRoot);
    try {
      const data = await getValuesFromPackageFile(packageDir);
      nxPackages.push(data);
    } catch (e) {}
  }

  return {
    tool: "nx",
    packages: nxPackages,
    root
  };
};

export { Package };
