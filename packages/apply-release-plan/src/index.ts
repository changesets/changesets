import { ReleasePlan, Config, ChangelogFunctions } from "@changesets/types";

import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import getChangelogEntries, {
  addCommitToChangesets,
  resolveChangelogFunctions
} from "@changesets/generate-changelogs";
import generateReleaseNotes from "@changesets/generate-release-notes";
import { Packages } from "@manypkg/get-packages";

import fs from "fs-extra";
import path from "path";
import prettier from "prettier";

import updatePackageJson from "./version-package";
import createVersionCommit from "./createVersionCommit";

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  packages: Packages,
  config: Config = defaultConfig
) {
  let cwd = packages.root.dir;

  let touchedFiles = [];

  const packagesByName = new Map(
    packages.packages.map(x => [x.packageJson.name, x])
  );

  let { releases, changesets, globalReleaseChangeset } = releasePlan;

  const versionCommit = createVersionCommit(releasePlan, config.commit);

  let changelogFunctions: ChangelogFunctions = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve("")
  };
  let changelogOpts: any;
  if (config.changelog) {
    changelogOpts = config.changelog[1];
    changelogFunctions = await resolveChangelogFunctions(
      config.changelog[0],
      cwd
    );
  }

  let moddedChangesets = await addCommitToChangesets(changesets, cwd);

  let changelogEntries = await getChangelogEntries(
    releases,
    moddedChangesets,
    packages,
    changelogFunctions,
    changelogOpts
  );

  let globalReleaseNotes;

  if (globalReleaseChangeset) {
    globalReleaseNotes = await generateReleaseNotes(
      releasePlan,
      moddedChangesets,
      packages,
      [changelogFunctions, changelogOpts]
    );
  }

  if (releasePlan.preState !== undefined) {
    if (releasePlan.preState.mode === "exit") {
      await fs.remove(path.join(cwd, ".changeset", "pre.json"));
    } else {
      await fs.writeFile(
        path.join(cwd, ".changeset", "pre.json"),
        JSON.stringify(releasePlan.preState, null, 2) + "\n"
      );
    }
  }

  let versionsToUpdate = releases.map(({ name, newVersion }) => ({
    name,
    version: newVersion
  }));

  let prettierConfig = await prettier.resolveConfig(cwd);

  for (let release of releases) {
    let { name } = release;
    let changelog = changelogEntries.get(name);
    let pkg = packagesByName.get(release.name);
    if (!pkg)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );

    let packageJson = updatePackageJson(
      release,
      versionsToUpdate,
      pkg.packageJson
    );

    let pkgJSONPath = path.resolve(pkg.dir, "package.json");

    let changelogPath = path.resolve(pkg.dir, "CHANGELOG.md");

    let parsedConfig = prettier.format(JSON.stringify(packageJson), {
      ...prettierConfig,
      filepath: pkgJSONPath,
      parser: "json",
      printWidth: 20
    });

    await fs.writeFile(pkgJSONPath, parsedConfig);
    touchedFiles.push(pkgJSONPath);

    if (changelog && changelog.length > 0) {
      await updateFile(changelogPath, changelog, name, prettierConfig);
      touchedFiles.push(changelogPath);
    }
  }

  if (
    releasePlan.preState === undefined ||
    releasePlan.preState.mode === "exit"
  ) {
    let changesetFolder = path.resolve(cwd, ".changeset");
    await Promise.all(
      changesets.map(async changeset => {
        let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
        let changesetFolderPath = path.resolve(changesetFolder, changeset.id);
        if (await fs.pathExists(changesetPath)) {
          touchedFiles.push(changesetPath);
          await fs.remove(changesetPath);
          // TO REMOVE LOGIC - this works to remove v1 changesets. We should be removed in the future
        } else if (await fs.pathExists(changesetFolderPath)) {
          touchedFiles.push(changesetFolderPath);
          await fs.remove(changesetFolderPath);
        }
      })
    );
  }

  if (globalReleaseNotes) {
    let globalReleaseNotesPath = path.resolve(
      cwd,
      config.globalReleaseNotesFileName
    );
    await updateFile(
      globalReleaseNotesPath,
      globalReleaseNotes,
      packages.root.packageJson.name,
      prettierConfig
    );

    touchedFiles.push(globalReleaseNotesPath);
  }

  if (config.commit) {
    let newTouchedFilesArr = [...touchedFiles];
    // Note, git gets angry if you try and have two git actions running at once
    // So we need to be careful that these iterations are properly sequential
    while (newTouchedFilesArr.length > 0) {
      let file = newTouchedFilesArr.shift();
      await git.add(path.relative(cwd, file!), cwd);
    }

    let commit = await git.commit(versionCommit, cwd);

    if (!commit) {
      console.error("Changesets ran into trouble committing your files");
    }
  }

  // We return the touched files mostly for testing purposes
  return touchedFiles;
}

async function updateFile(
  thisPath: string,
  newContents: string,
  name: string,
  prettierConfig: prettier.Options | null
) {
  let templateString = `\n\n${newContents.trim()}\n`;

  try {
    if (fs.existsSync(thisPath)) {
      await prependFile(thisPath, templateString, name, prettierConfig);
    } else {
      await fs.writeFile(thisPath, `# ${name}${templateString}`);
    }
  } catch (e) {
    console.warn(e);
  }
}

async function prependFile(
  filePath: string,
  data: string,
  name: string,
  prettierConfig?: prettier.Options | null
) {
  const fileData = fs.readFileSync(filePath).toString();
  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${name}${data}`;
    await fs.writeFile(
      filePath,
      prettier.format(completelyNewChangelog, {
        ...prettierConfig,
        filepath: filePath,
        parser: "markdown"
      })
    );
    return;
  }
  const newChangelog = fileData.replace("\n", data);

  await fs.writeFile(
    filePath,
    prettier.format(newChangelog, {
      ...prettierConfig,
      filepath: filePath,
      parser: "markdown"
    })
  );
}
