import { Changeset, BumpType } from "../types";

function maxType(types: Array<BumpType>) {
  if (types.includes("major")) return "major";
  if (types.includes("minor")) return "minor";
  if (types.includes("patch")) return "patch";
  return "none";
}

export default function flattenReleases(
  changesets: Array<Changeset>,
  allLinkedPackages: Array<Array<string>>
) {
  const flatChangesets = changesets
    .map(changeset => [
      ...changeset.releases.map(release => ({
        name: release.name,
        type: release.type,
        commit: changeset.commit,
        id: changeset.id
      })),
      ...changeset.dependents.map(dependent => ({
        name: dependent.name,
        type: dependent.type,
        commit: changeset.commit,
        id: changeset.id
      }))
    ])
    .reduce((acc, a) => [...acc, ...a], []) // flatten
    .reduce<{
      [key: string]: Array<{
        name: string;
        type: BumpType;
        commit: string;
        id: string;
      }>;
    }>((acc, release) => {
      if (!acc[release.name]) {
        acc[release.name] = [];
      }
      acc[release.name].push(release);
      return acc;
    }, {});

  const flatReleases = new Map<
    string,
    {
      name: string;
      type: BumpType;
      commits: Array<string>;
      changesets: Array<string>;
    }
  >(
    Object.entries(flatChangesets).map(([name, releases]) => [
      name,
      {
        name,
        type: maxType(releases.map(r => r.type)),
        commits: [...new Set(releases.map(r => r.commit))].filter(a => a),
        changesets: [...new Set(releases.map(r => r.id))]
      }
    ])
  );

  for (const linkedPackages of allLinkedPackages) {
    const allBumpTypes: Array<BumpType> = [];
    for (let linkedPackage of linkedPackages) {
      let release = flatReleases.get(linkedPackage);
      if (release) {
        allBumpTypes.push(release.type);
      }
    }
    const highestBumpType = maxType(allBumpTypes);
    for (let linkedPackage of linkedPackages) {
      let release = flatReleases.get(linkedPackage);
      if (release) {
        release.type = highestBumpType;
      }
    }
  }

  return [...flatReleases.values()];
}
