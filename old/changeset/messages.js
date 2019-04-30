const logger = require('@atlaskit/build-utils/logger');
const { green, red } = require('chalk');
const boxen = require('boxen');
const outdent = require('outdent');

// prettier-ignore
function printIntroBanner() {
  const message = outdent`
    ${red('================ NOTE ================')}
    We have made some major changes to the release process.
    Please make sure you ${red('read this before continuing')}.

    You will now ${red('only')} be asked about packages you choose to bump.

    We will patch everything else that needs to be ${red('updated automatically')}.

    For any package you need to release beyond a patch, you should make
    an explicit changeset for that release.
    i.e. "summary: bumping major dependency on editor-core"

    For more info, reach out to Fabric Build.
  `;
  const prettyMessage = boxen(message, {
    borderStyle: 'double',
    align: 'center',
  });
  logger.log(prettyMessage);
}

function printConfirmationMessage(changeset) {
  function getReleasesOfType(type) {
    return changeset.releases
      .filter(release => release.type === type)
      .map(release => release.name);
  }
  logger.log('=== Releasing the following packages ===');
  const majorReleases = getReleasesOfType('major');
  const minorReleases = getReleasesOfType('minor');
  const patchReleases = getReleasesOfType('patch');
  const patchDependents = changeset.dependents
    .filter(dep => dep.type === 'patch')
    .map(dep => dep.name);
  const majorDependents = changeset.dependents
    .filter(dep => dep.type === 'major')
    .map(dep => red(dep.name));

  if (majorReleases.length > 0)
    logger.log(`${green('[Major]')}\n  ${majorReleases.join(', ')}`);
  if (minorReleases.length > 0)
    logger.log(`${green('[Minor]')}\n  ${minorReleases.join(', ')}`);
  if (patchReleases.length > 0)
    logger.log(`${green('[Patch]')}\n  ${patchReleases.join(', ')}`);
  if (patchDependents.length > 0)
    logger.log(
      `${green('[Dependents (patch)]')}\n  ${patchDependents.join('\n  ')}`,
    );
  if (majorDependents.length > 0)
    logger.log(
      `${green('[Dependents (major)]')}\n  ${majorDependents.join('\n  ')}`,
    );

  if (changeset.dependents.length > 0) {
    const message = outdent`
      ${red('========= NOTE ========')}
      All dependents that are bumped will be ${red('patch bumped')}.
      If any of the above need a higher bump than this, you will need to create a ${red(
        'separate changeset',
      )} for this
      Please read the above list ${red(
        'carefully',
      )} to make sure you're not missing anything!`;
    const prettyMessage = boxen(message, {
      borderStyle: 'double',
      align: 'center',
    });
    logger.log(prettyMessage);
  }
}

module.exports = { printIntroBanner, printConfirmationMessage };
