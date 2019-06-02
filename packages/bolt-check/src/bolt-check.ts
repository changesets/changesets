import getWorkspaces from "get-workspaces";
import semver from "semver";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import detectIndent from "detect-indent";

function versionRangeToRangeType(versionRange: string) {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  return "";
}

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

type MissingDep = {
  type: "missingDependency";
  pkgName: string;
  dependency: string;
  pkgVersion: string;
};

type InternalMismatch = {
  type: "internalMismatch";
  pkgName: string;
  dependency: string;
  version: string;
};

type ExternalMismatch = {
  type: "externalMismatch";
  pkgName: string;
  dependency: string;
  rootVersion: string;
  pkgVersion: string;
};

type ErrorObj = InternalMismatch | ExternalMismatch | MissingDep;

type PkgErrors = InternalMismatch | ExternalMismatch;

const getInternalErrorMessage = ({
  pkgName,
  dependency,
  version
}: InternalMismatch) =>
  chalk`{green ${pkgName}} needs to update its dependency on {green ${dependency}} to be compatible with {yellow ${version}}`;

const getMissingDepErrorMessage = ({ pkgName, dependency }: MissingDep) =>
  chalk`{yellow ${dependency}} is a dependency of {green ${pkgName}}, but is not found in the project root.`;

const getExternalErrorMessage = ({
  pkgName,
  dependency,
  rootVersion,
  pkgVersion
}: ExternalMismatch) =>
  chalk`{yellow ${pkgName}} relies on {green ${dependency}} at {red ${pkgVersion}}, but your project relies on  {green ${dependency}} at {green ${rootVersion}}.`;

// TODO: This function could sort, and order these errors to make nicer output. Not doing that for now.
let printErrors = (errors: ErrorObj[]) => {
  errors.forEach(error => {
    switch (error.type) {
      case "internalMismatch":
        console.error(getInternalErrorMessage(error));
        break;
      case "externalMismatch":
        console.error(getExternalErrorMessage(error));
        break;
      case "missingDependency":
        console.error(getMissingDepErrorMessage(error));
    }
  });
};

type workspaceConfig = {
  name: string;
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
  optionalDependencies?: { [key: string]: string };
};

const flatten = (workspace: workspaceConfig) => {
  let flatDeps = new Map();

  for (let depType of DEPENDENCY_TYPES) {
    let deps = workspace[depType];
    if (!deps || typeof deps !== "object") continue;
    for (let [name, version] of Object.entries(deps)) {
      if (!flatDeps.has(name)) {
        flatDeps.set(name, version);
      }
    }
  }
  return flatDeps;
};

export default async function boltCheck(config: {
  cwd: string;
  silent?: boolean;
  fix?: boolean;
}) {
  let errors: ErrorObj[] = [];

  let workspaces = await getWorkspaces(config);

  if (!workspaces) {
    console.error("could not resolve workspaces to check");
    throw new Error("could not resolve workspaces to check");
  }

  let workspaceVersions = new Map();
  let rootPkgJson: workspaceConfig = JSON.parse(
    await fs.readFile(path.resolve(config.cwd, "package.json"), "utf-8")
  );

  let rootDeps = flatten(rootPkgJson);

  for (let workspace of workspaces) {
    workspaceVersions.set(workspace.config.name, workspace.config.version);
  }

  for (let workspace of workspaces) {
    let flatDeps = flatten(workspace.config);
    for (let [name, range] of flatDeps.entries()) {
      if (workspaceVersions.has(name)) {
        let currentVersion = workspaceVersions.get(name);
        if (!semver.satisfies(currentVersion, range)) {
          errors.push({
            type: "internalMismatch",
            pkgName: workspace.name,
            dependency: name,
            version: currentVersion
          });
        }
      } else {
        let rootVersion = rootDeps.get(name);
        if (!rootVersion) {
          errors.push({
            type: "missingDependency",
            pkgName: workspace.name,
            dependency: name,
            pkgVersion: range
          });
        } else if (rootVersion !== range) {
          errors.push({
            type: "externalMismatch",
            pkgName: workspace.name,
            pkgVersion: range,
            dependency: name,
            rootVersion
          });
        }
      }
    }
  }

  if (config.silent) {
    return errors;
  }

  if (errors.length > 0 && !config.fix) {
    console.error(chalk.red("there are errors in your config!"));
    printErrors(errors);
    process.exit(1);
  } else if (errors.length > 0 && config.fix) {
    let missingDepErrors = [];
    let otherErrors = [];

    for (let error of errors) {
      if (error.type === "missingDependency") {
        missingDepErrors.push(error);
      } else {
        otherErrors.push(error);
      }
    }

    if (missingDepErrors.length > 0) {
      await fixMissingDependencies(missingDepErrors, config.cwd);
    }

    let workSpacesToUpdate: {
      [key: string]: { pkgDir: string; errors: PkgErrors[] };
    } = {};

    otherErrors.forEach(error => {
      if (!workSpacesToUpdate[error.pkgName]) {
        // @ts-ignore
        let workspace = workspaces.find(w => w.name === error.pkgName);
        if (!workspace) {
          throw new Error("congrats! you found an impossible error");
        }

        workSpacesToUpdate[error.pkgName] = {
          pkgDir: workspace.dir,
          errors: []
        };
      }
      workSpacesToUpdate[error.pkgName].errors.push(error);
    });

    await Promise.all(
      Object.values(workSpacesToUpdate).map(async ({ pkgDir, errors }) =>
        fixPkgErrors(errors, pkgDir)
      )
    );
  } else {
    console.log("Looks like your dependencies are fine");
  }
}

const fixPkgErrors = async (errors: PkgErrors[], pkgDir: string) => {
  let pkgPath = path.resolve(pkgDir, "package.json");
  let pkgRaw = await fs.readFile(pkgPath, "utf-8");
  let indent = detectIndent(pkgRaw).indent || "  ";
  let pkg = JSON.parse(pkgRaw);

  errors.forEach(error => {
    if (error.type === "internalMismatch") {
      let { dependency, version } = error;
      DEPENDENCY_TYPES.forEach(depType => {
        if (pkg[depType] && pkg[depType][dependency]) {
          let currentRange = pkg[depType][dependency];
          let rangeType = versionRangeToRangeType(currentRange);
          pkg[depType][dependency] = rangeType + version;
        }
      });
    }
    if (error.type === "externalMismatch") {
      DEPENDENCY_TYPES.forEach(depType => {
        let { dependency, rootVersion } = error;
        if (pkg[depType] && pkg[depType][dependency]) {
          pkg[depType][dependency] = rootVersion;
        }
      });
    }
  });

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, indent));
};

const fixMissingDependencies = async (errors: MissingDep[], cwd: string) => {
  let cannotAdd: { [key: string]: string[] } = {};
  let update = new Map();

  // This step checks for dependencies that exist at two different versions
  // within different packages.
  errors.forEach(({ dependency, pkgVersion }) => {
    const conflict = update.get(dependency);
    if (conflict && conflict !== pkgVersion) {
      let v1 = update.get(dependency);
      cannotAdd[dependency].push(v1, pkgVersion);
      update.delete(dependency);
    } else if (
      cannotAdd[dependency] &&
      !cannotAdd[dependency].includes(pkgVersion)
    ) {
      cannotAdd[dependency].push(pkgVersion);
    } else {
      update.set(dependency, pkgVersion);
    }
  });

  let rootPkgJsonPath = path.resolve(cwd, "package.json");
  let rootRaw = await fs.readFile(rootPkgJsonPath, "utf-8");
  let indent = detectIndent(rootRaw).indent || "  ";
  let rootPkgJson = JSON.parse(rootRaw);

  update.forEach((pkgVersion, dependency) => {
    if (!rootPkgJson.dependencies) {
      rootPkgJson.dependencies = {};
    }
    rootPkgJson.dependencies[dependency] = pkgVersion;
  });

  await fs.writeFile(
    rootPkgJsonPath,
    JSON.stringify(rootPkgJson, null, indent)
  );

  if (Object.keys(cannotAdd).length) {
    Object.entries(cannotAdd).forEach(([name, versions]) => {
      console.error(
        "could not automatically udpate",
        name,
        // TODO Add enough info so we can say where each of these versions is
        "because it had multiple versions in your repository:",
        ...versions
      );
    });
  }
};
