import fs from "fs-extra";
import path from "path";
import util from "util";
import prettier from "prettier";

import generateMarkdownTemplate from "./template";
import logger from "../logger";
import * as bolt from "../bolt-replacements";

function writeFile(filePath, fileContents) {
  return util.promisify(cb => fs.writeFile(filePath, fileContents, cb))();
}

export default async function updateChangelog(releaseObject, opts) {
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
        } in project.`
      );
    }
    const changelogPath = path.join(pkg.dir, "CHANGELOG.md");

    const markdown = await generateMarkdownTemplate(
      release,
      releaseObject,
      opts
    );

    const templateString = `\n\n${markdown.trim("\n")}\n`;
    try {
      if (fs.existsSync(changelogPath)) {
        await prependFile(changelogPath, templateString, pkg, cwd);
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

async function prependFile(filePath, data, pkg, cwd) {
  const prettierConfig = await prettier.resolveConfig(cwd);

  const fileData = fs.readFileSync(filePath).toString();
  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${pkg.name}${data}`;
    fs.writeFileSync(
      filePath,
      prettier.format(completelyNewChangelog, {
        ...prettierConfig,
        parser: "markdown"
      })
    );
    return;
  }
  const newChangelog = fileData.replace("\n", data);

  fs.writeFileSync(
    filePath,
    prettier.format(newChangelog, { ...prettierConfig, parser: "markdown" })
  );
}
