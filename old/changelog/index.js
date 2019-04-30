const generateMarkdownTemplate = require('./template');
const fs = require('fs');
const bolt = require('bolt');
const path = require('path');
const util = require('util');
const logger = require('@atlaskit/build-utils/logger');

function writeFile(filePath, fileContents) {
  return util.promisify(cb => fs.writeFile(filePath, fileContents, cb))();
}

async function updateChangelog(releaseObject, opts) {
  const cwd = opts.cwd || process.cwd();
  const allPackages = await bolt.getWorkspaces({ cwd });
  const udpatedChangelogs = [];
  // Updating ChangeLog files for each package
  for (const release of releaseObject.releases) {
    const pkg = allPackages.find(a => a.name === release.name);
    if (!pkg) {
      logger.warn(
        `While writing changelog, could not find workspace ${
          release.name
        } in project.`,
      );
    }
    const changelogPath = path.join(pkg.dir, 'CHANGELOG.md');

    const markdown = await generateMarkdownTemplate(
      release,
      releaseObject,
      opts,
    );

    const templateString = `\n\n${markdown.trim('\n')}\n`;
    try {
      if (fs.existsSync(changelogPath)) {
        await prependFile(changelogPath, templateString, pkg);
      } else {
        await writeFile(changelogPath, `# ${pkg.name}${templateString}`);
      }
    } catch (e) {
      logger.warn(e);
      return;
    }
    logger.log(`Updated file ${changelogPath}`);
    udpatedChangelogs.push(changelogPath);
  }
  return udpatedChangelogs;
}

async function prependFile(filePath, data, pkg) {
  const fileData = fs.readFileSync(filePath).toString();
  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${pkg.name}${data}`;
    fs.writeFileSync(filePath, completelyNewChangelog);
    return;
  }
  const newChangelog = fileData.replace('\n', data);
  fs.writeFileSync(filePath, newChangelog);
}

module.exports = updateChangelog;
