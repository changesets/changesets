async function getReleaseLines(changesets, releaseName, config) {
  return Promise.all(
    changesets.map(async changeset => {
      const relevantRelease = changeset.releases.find(
        r => r.name === releaseName
      );
      return config.getReleaseLine(changeset, relevantRelease.type);
    })
  );
}

// release is the package and version we are releasing
export default async function generateMarkdownTemplate(
  release,
  releaseObject,
  config
) {
  // NOTE: The release object we receive here has more information than the ones in release commit
  // messages
  const { changesets, releases } = releaseObject;
  // get changesets that "release" this package (not a dependent bump)

  const releaseObj = {
    major: [],
    minor: [],
    patch: []
  };

  changesets.forEach(cs => {
    const rls = cs.releases.find(r => r.name === release.name);
    if (rls) {
      releaseObj[rls.type].push(cs);
    }
  });

  // First, we construct the release lines, summaries of changesets that caused us to be released
  const majorReleaseLines = await getReleaseLines(
    releaseObj.major,
    release.name,
    config
  );

  const minorReleaseLines = await getReleaseLines(
    releaseObj.minor,
    release.name,
    config
  );
  const patchReleaseLines = await getReleaseLines(
    releaseObj.patch,
    release.name,
    config
  );

  // get changesets that bump our dependencies
  // There is a happy accident that this includes all dependents being bumped, so we
  // do not need to enquire into why the dependents are being bumped.
  const dependentChangesets = changesets.filter(cs =>
    cs.dependents.find(d => d.name === release.name)
  );

  const dependenciesUpdated = new Set( // We use a set so we can dedupe on the fly
    dependentChangesets
      .map(
        changeset =>
          changeset.dependents.find(d => d.name === release.name).dependencies
      )
      .reduce((acc, a) => [...acc, ...a], []) // flatten
  );

  const dependenciesUpdatedArr = [...dependenciesUpdated]
    .map(dependency => releases.find(r => r.name === dependency))
    // TODO: Figure out why we need to use the identity function here
    // In all cases, it should always be here
    .filter(r => r);

  const dependencyReleaseLine = await config.getDependencyReleaseLine(
    dependentChangesets,
    dependenciesUpdatedArr
  );

  return [
    `## ${release.version}`,
    ...majorReleaseLines,
    ...minorReleaseLines,
    ...patchReleaseLines,
    dependencyReleaseLine
  ]
    .filter(line => line)
    .join("\n");
}
