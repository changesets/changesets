export default async function updatePackageVersions(
  updatedPackages: VersionMap,
  opts: Options = {}
): Promise<Array<string>> {
  let cwd = opts.cwd || process.cwd();
  let project = await Project.init(cwd);
  let packages = await project.getPackages();
  let { graph } = await project.getDependencyGraph(packages);
  let editedPackages = new Set();

  let internalDeps = Object.keys(updatedPackages).filter(dep => graph.has(dep));
  let externalDeps = Object.keys(updatedPackages).filter(
    dep => !graph.has(dep)
  );

  if (externalDeps.length !== 0) {
    logger.warn(
      messages.externalDepsPassedToUpdatePackageVersions(externalDeps)
    );
  }

  for (let pkg of packages) {
    let promises = [];
    let name = pkg.getName();

    for (let depName of internalDeps) {
      let depRange = String(pkg.getDependencyVersionRange(depName));
      let depTypes = pkg.getDependencyTypes(depName);
      let rangeType = versionRangeToRangeType(depRange);
      let newDepRange = rangeType + updatedPackages[depName];
      if (depTypes.length === 0) continue;

      let inUpdatedPackages = includes(internalDeps, name);
      let willLeaveSemverRange = !semver.satisfies(
        updatedPackages[depName],
        depRange
      );
      // This check determines whether the package will be released. If the
      // package will not be released, we throw.
      if (!inUpdatedPackages && willLeaveSemverRange) {
        throw new Error(
          messages.invalidBoltWorkspacesFromUpdate(
            name,
            depName,
            depRange,
            updatedPackages[depName]
          )
        );
      }
      if (!inUpdatedPackages) continue;

      for (let depType of depTypes) {
        await pkg.setDependencyVersionRange(depName, depType, newDepRange);
      }
      editedPackages.add(pkg.filePath);
    }
  }

  return Array.from(editedPackages);
}
