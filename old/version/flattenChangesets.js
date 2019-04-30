function maxType(types) {
  if (types.includes('major')) return 'major';
  if (types.includes('minor')) return 'minor';
  if (types.includes('patch')) return 'patch';
  return 'none';
}

function flattenReleases(changesets) {
  let abc = changesets
    .map(changeset => [
      ...changeset.releases.map(release => ({
        name: release.name,
        type: release.type,
        commit: changeset.commit,
      })),
      ...changeset.dependents.map(dependent => ({
        name: dependent.name,
        type: dependent.type,
        commit: changeset.commit,
      })),
    ])
    .reduce((acc, a) => [...acc, ...a], []) // flatten
    .reduce((acc, release) => {
      if (!acc[release.name]) {
        acc[release.name] = [];
      }
      acc[release.name].push(release);
      return acc;
    }, {});

  return Object.entries(abc).map(([name, releases]) => ({
    name,
    type: maxType(releases.map(r => r.type)),
    commits: [...new Set(releases.map(r => r.commit))],
  }));
}

module.exports = flattenReleases;
