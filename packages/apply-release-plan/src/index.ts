import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  ChangelogFunctions,
  Config,
  ModCompWithPackage,
  NewChangeset,
  ReleasePlan,
} from "@changesets/types";
import type { Packages } from "@manypkg/get-packages";
import detectIndent from "detect-indent";
import fs from "node:fs/promises";
import path from "path";
import { resolve } from "import-meta-resolve";
import { formatly, resolveFormatter } from "formatly";
import getChangelogEntry from "./get-changelog-entry.ts";
import versionPackage from "./version-package.ts";
import { fileURLToPath, pathToFileURL } from "node:url";

function stringDefined(s: string | undefined): s is string {
  return !!s;
}
async function getCommitsThatAddChangesets(
  changesetIds: string[],
  cwd: string
) {
  const paths = changesetIds.map((id) => `.changeset/${id}.md`);
  const commits = await git.getCommitsThatAddFiles(paths, { cwd });

  if (commits.every(stringDefined)) {
    // We have commits for all files
    return commits;
  }

  // Some files didn't exist. Try legacy filenames instead
  const missingIds = changesetIds
    .map((id, i) => (commits[i] ? undefined : id))
    .filter(stringDefined);

  const legacyPaths = missingIds.map((id) => `.changeset/${id}/changes.json`);
  const commitsForLegacyPaths = await git.getCommitsThatAddFiles(legacyPaths, {
    cwd,
  });

  // Fill in the blanks in the array of commits
  changesetIds.forEach((id, i) => {
    if (!commits[i]) {
      const missingIndex = missingIds.indexOf(id);
      commits[i] = commitsForLegacyPaths[missingIndex];
    }
  });

  return commits;
}

type Formatter = (filePath: string) => Promise<void>;

async function getFormatter(
  config: Config["format"],
  cwd: string
): Promise<Formatter> {
  if (config === false) return async () => {};

  const formatter =
    config === "auto" ? (await resolveFormatter(cwd))?.name : config;
  if (!formatter) return async () => {};

  return async (filePath: string) => {
    await formatly([filePath], { cwd, formatter });
  };
}

export default async function applyReleasePlan(
  releasePlan: ReleasePlan,
  packages: Packages,
  config: Config = defaultConfig,
  snapshot?: string | boolean,
  contextDir = path.dirname(fileURLToPath(import.meta.url))
) {
  let cwd = packages.root.dir;

  let touchedFiles = [];

  const packagesByName = new Map(
    packages.packages.map((x) => [x.packageJson.name, x])
  );

  let { releases, changesets } = releasePlan;

  let releasesWithPackage = releases.map((release) => {
    let pkg = packagesByName.get(release.name);
    if (!pkg)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`
      );
    return {
      ...release,
      ...pkg,
    };
  });

  // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases
  let releaseWithChangelogs = await getNewChangelogEntry(
    releasesWithPackage,
    changesets,
    config,
    cwd,
    contextDir
  );

  if (releasePlan.preState !== undefined && snapshot === undefined) {
    if (releasePlan.preState.mode === "exit") {
      await fs.rm(path.join(cwd, ".changeset", "pre.json"), {
        recursive: true,
        force: true,
      });
    } else {
      await fs.writeFile(
        path.join(cwd, ".changeset", "pre.json"),
        JSON.stringify(releasePlan.preState, null, 2) + "\n"
      );
    }
  }

  let versionsToUpdate = releases.map(({ name, newVersion, type }) => ({
    name,
    version: newVersion,
    type,
  }));

  // iterate over releases updating packages
  let finalisedRelease = releaseWithChangelogs.map((release) => {
    return versionPackage(release, versionsToUpdate, {
      updateInternalDependencies: config.updateInternalDependencies,
      onlyUpdatePeerDependentsWhenOutOfRange:
        config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
          .onlyUpdatePeerDependentsWhenOutOfRange,
      bumpVersionsWithWorkspaceProtocolOnly:
        config.bumpVersionsWithWorkspaceProtocolOnly,
      snapshot,
    });
  });

  const formatter = await getFormatter(config.format, cwd);

  for (let release of finalisedRelease) {
    let { changelog, packageJson, dir, name } = release;

    const pkgJSONPath = path.resolve(dir, "package.json");
    await updatePackageJson(pkgJSONPath, packageJson);
    touchedFiles.push(pkgJSONPath);

    if (changelog && changelog.length > 0) {
      const changelogPath = path.resolve(dir, "CHANGELOG.md");
      await updateChangelog(changelogPath, changelog, name, formatter);
      touchedFiles.push(changelogPath);
    }
  }

  if (
    releasePlan.preState === undefined ||
    releasePlan.preState.mode === "exit"
  ) {
    let changesetFolder = path.resolve(cwd, ".changeset");
    await Promise.all(
      changesets.map(async (changeset) => {
        let changesetPath = path.resolve(changesetFolder, `${changeset.id}.md`);
        let changesetFolderPath = path.resolve(changesetFolder, changeset.id);
        if (
          await fs.access(changesetPath).then(
            () => true,
            () => false
          )
        ) {
          // DO NOT remove changeset for skipped packages
          // Mixed changeset that contains both skipped packages and not skipped packages are disallowed
          // At this point, we know there is no such changeset, because otherwise the program would've already failed,
          // so we just check if any skipped package exists in this changeset, and only remove it if none exists
          // options to skip packages were added in v2, so we don't need to do it for v1 changesets
          if (
            !changeset.releases.find((release) =>
              shouldSkipPackage(packagesByName.get(release.name)!, {
                ignore: config.ignore,
                allowPrivatePackages: config.privatePackages.version,
              })
            )
          ) {
            touchedFiles.push(changesetPath);
            await fs.rm(changesetPath, { recursive: true, force: true });
          }
          // TO REMOVE LOGIC - this works to remove v1 changesets. We should be removed in the future
        } else if (
          await fs.access(changesetFolderPath).then(
            () => true,
            () => false
          )
        ) {
          touchedFiles.push(changesetFolderPath);
          await fs.rm(changesetFolderPath, { recursive: true, force: true });
        }
      })
    );
  }

  // We return the touched files to be committed in the cli
  return touchedFiles;
}

async function getNewChangelogEntry(
  releasesWithPackage: ModCompWithPackage[],
  changesets: NewChangeset[],
  config: Config,
  cwd: string,
  contextDir: string
) {
  if (!config.changelog) {
    return Promise.resolve(
      releasesWithPackage.map((release) => ({
        ...release,
        changelog: null,
      }))
    );
  }

  let getChangelogFuncs: ChangelogFunctions = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve(""),
  };

  const changelogOpts = config.changelog[1];
  let changesetPath = path.join(cwd, ".changeset");
  let changelogPath;

  try {
    changelogPath = resolve(
      config.changelog[0],
      pathToFileURL(changesetPath).toString()
    );
  } catch {
    changelogPath = resolve(
      config.changelog[0],
      pathToFileURL(contextDir).toString()
    );
  }

  let possibleChangelogFunc = await import(changelogPath);
  if (possibleChangelogFunc.default) {
    possibleChangelogFunc = possibleChangelogFunc.default;
  }
  if (
    typeof possibleChangelogFunc.getReleaseLine === "function" &&
    typeof possibleChangelogFunc.getDependencyReleaseLine === "function"
  ) {
    getChangelogFuncs = possibleChangelogFunc;
  } else {
    throw new Error("Could not resolve changelog generation functions");
  }

  let commits = await getCommitsThatAddChangesets(
    changesets.map((cs) => cs.id),
    cwd
  );
  let moddedChangesets = changesets.map((cs, i) => ({
    ...cs,
    commit: commits[i],
  }));

  return Promise.all(
    releasesWithPackage.map(async (release) => {
      let changelog = await getChangelogEntry(
        release,
        releasesWithPackage,
        moddedChangesets,
        getChangelogFuncs,
        changelogOpts,
        {
          updateInternalDependencies: config.updateInternalDependencies,
          onlyUpdatePeerDependentsWhenOutOfRange:
            config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
              .onlyUpdatePeerDependentsWhenOutOfRange,
        }
      );

      return {
        ...release,
        changelog,
      };
    })
  ).catch((e) => {
    console.error(
      "The following error was encountered while generating changelog entries"
    );
    console.error(
      "We have escaped applying the changesets, and no files should have been affected"
    );
    throw e;
  });
}

async function updateChangelog(
  changelogPath: string,
  changelog: string,
  name: string,
  formatter: Formatter
) {
  let templateString = `\n\n${changelog.trim()}\n`;
  let fileData;

  try {
    fileData = (await fs.readFile(changelogPath)).toString();
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
    await writeFormattedMarkdownFile(
      changelogPath,
      `# ${name}${templateString}`,
      formatter
    );
    return;
  }

  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${name}${templateString}`;
    await writeFormattedMarkdownFile(
      changelogPath,
      completelyNewChangelog,
      formatter
    );
    return;
  }

  const newChangelog = fileData.replace("\n", templateString);

  await writeFormattedMarkdownFile(changelogPath, newChangelog, formatter);
}

async function updatePackageJson(
  pkgJsonPath: string,
  pkgJson: any
): Promise<void> {
  const pkgRaw = await fs.readFile(pkgJsonPath, "utf8");
  const indent = detectIndent(pkgRaw).indent || "  ";
  const stringified =
    JSON.stringify(pkgJson, null, indent) + (pkgRaw.endsWith("\n") ? "\n" : "");

  return fs.writeFile(pkgJsonPath, stringified);
}

async function writeFormattedMarkdownFile(
  filePath: string,
  content: string,
  formatter: Formatter
) {
  await fs.writeFile(filePath, content);
  await formatter(filePath);
}
