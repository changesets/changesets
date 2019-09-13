import fs from "fs-extra";
import path from "path";
import detectIndent from "detect-indent";
import getWorkspaces from "get-workspaces";
import versionRangeToRangeType from "@changesets/get-version-range-type";
import { PkgErrors, MissingDep, Config, ErrorObj } from "../types";
import { DEPENDENCY_TYPES } from "../constants";

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

const moveDevDepsToDeps = async (cwd: string) => {
  let rootPkgJsonPath = path.resolve(cwd, "package.json");
  let rootRaw = await fs.readFile(rootPkgJsonPath, "utf-8");
  let indent = detectIndent(rootRaw).indent || "  ";
  let rootPkgJson = JSON.parse(rootRaw);

  rootPkgJson.dependencies = {
    ...rootPkgJson.dependencies,
    ...rootPkgJson.devDependencies
  };
  delete rootPkgJson.devDependencies;
  await fs.writeFile(
    rootPkgJsonPath,
    JSON.stringify(rootPkgJson, null, indent)
  );
};

export default async function fix(errors: ErrorObj[], config: Config) {
  let missingDepErrors = [];
  let otherErrors = [];

  let hasRootDevDeps;

  let workspaces = await getWorkspaces(config);

  if (!workspaces) {
    console.error("could not resolve workspaces to check");
    throw new Error("could not resolve workspaces to check");
  }

  for (let error of errors) {
    if (error.type === "missingDependency") {
      missingDepErrors.push(error);
    } else if (error.type === "rootContainsDevDeps") {
      hasRootDevDeps = true;
    } else {
      otherErrors.push(error);
    }
  }

  if (missingDepErrors.length > 0) {
    await fixMissingDependencies(missingDepErrors, config.cwd);
  }

  if (hasRootDevDeps) {
    await moveDevDepsToDeps(config.cwd);
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
}
