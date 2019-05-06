function maxType(types) {
  if (types.includes("major")) return "major";
  if (types.includes("minor")) return "minor";
  if (types.includes("patch")) return "patch";
  return "none";
}

export default function flattenReleases(changesets) {
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
    .reduce((acc, release) => {
      if (!acc[release.name]) {
        acc[release.name] = [];
      }
      acc[release.name].push(release);
      return acc;
    }, {});

  return Object.entries(flatChangesets).map(([name, releases]) => ({
    name,
    type: maxType(releases.map(r => r.type)),
    commits: [...new Set(releases.map(r => r.commit))].filter(a => a),
    changesets: [...new Set(releases.map(r => r.id))]
  }));
}
