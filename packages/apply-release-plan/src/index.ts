import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultConfig } from "@changesets/config";
import {
  defaultDetectOrder,
  detect as detectFormatter,
  format,
} from "@changesets/format";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import type {
  ChangelogFunctions,
  ComprehensiveRelease,
  Packages,
  Config,
  ModCompWithPackage,
  NewChangeset,
  ReleasePlan,
} from "@changesets/types";
import { resolve } from "import-meta-resolve";
import { editJson, type EditJsonOperation } from "./edit-json.ts";
import { getChangelogEntry } from "./get-changelog-entry.ts";
import {
  getDependencyVersionEdits,
  type DependencyUpdateOptions,
} from "./version-package.ts";

function importResolveFromDir(specifier: string, dir: string) {
  return resolve(specifier, pathToFileURL(path.join(dir, "x.mjs")).toString());
}

async function getCommitsThatAddChangesets(
  changesetIds: string[],
  cwd: string,
) {
  const paths = changesetIds.map((id) => `.changeset/${id}.md`);
  const commits = await git.getCommitsThatAddFiles(paths, { cwd });

  return commits;
}

async function getFormatter(
  config: Config["format"],
  cwd: string,
): Promise<(patterns: string[]) => Promise<void>> {
  if (config === false) return async () => {};

  const formatter =
    config === "auto"
      ? await detectFormatter({
          cwd,
          // Biome doesn't support formatting markdown files
          order: defaultDetectOrder.filter((f) => f !== "biome"),
        })
      : config;
  if (!formatter) return async () => {};

  return async (patterns: string[]) => {
    await format(patterns, { cwd, formatter });
  };
}

async function updatePackageJson(dir: string, edits: EditJsonOperation[]) {
  if (edits.length === 0) {
    return;
  }

  const pkgJsonPath = path.resolve(dir, "package.json");
  const pkgRaw = await fs.readFile(pkgJsonPath, "utf8");
  const pkgUpdated = editJson(pkgRaw, edits);
  await fs.writeFile(pkgJsonPath, pkgUpdated);
  return pkgJsonPath;
}

export async function applyReleasePlan(
  releasePlan: ReleasePlan,
  packages: Packages,
  config: Config = defaultConfig,
  snapshot?: string | boolean,
  contextDir = import.meta.dirname,
) {
  const cwd = packages.rootDir;

  const touchedFiles: string[] = [];

  const packagesByName = new Map(
    packages.packages.map((x) => [x.packageJson.name, x]),
  );

  const { releases, changesets } = releasePlan;

  const releasesWithPackage = releases.map((release) => {
    const pkg = packagesByName.get(release.name);
    if (!pkg)
      throw new Error(
        `Could not find matching package for release of: ${release.name}`,
      );
    return {
      ...release,
      ...pkg,
    };
  });

  // I think this might be the wrong place to do this, but gotta do it somewhere -  add changelog entries to releases
  const releaseWithChangelogs = await getNewChangelogEntry(
    releasesWithPackage,
    changesets,
    config,
    cwd,
    contextDir,
  );

  if (releasePlan.preState != null && snapshot == null) {
    if (releasePlan.preState.mode === "exit") {
      await fs.rm(path.join(cwd, ".changeset", "pre.json"), {
        recursive: true,
        force: true,
      });
    } else {
      await fs.writeFile(
        path.join(cwd, ".changeset", "pre.json"),
        JSON.stringify(releasePlan.preState, null, 2) + "\n",
      );
    }
    touchedFiles.push(path.join(cwd, ".changeset", "pre.json"));
  }

  const versionsToUpdate = releases.map(
    (release): ComprehensiveRelease & { dir: string } => ({
      ...release,
      dir: packagesByName.get(release.name)!.dir,
    }),
  );

  const dependencyUpdateOptions: DependencyUpdateOptions = {
    cwd,
    updateInternalDependencies: config.updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange:
      config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
        .onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly:
      config.bumpVersionsWithWorkspaceProtocolOnly,
    snapshot,
  };

  const filesToFormat: string[] = [];
  for (const release of releaseWithChangelogs) {
    const { changelog, dir, name, newVersion, packageJson } = release;
    const pkgJsonEdits = getDependencyVersionEdits(
      packageJson,
      versionsToUpdate,
      dependencyUpdateOptions,
    );
    if (newVersion != null) {
      pkgJsonEdits.push({ keys: ["version"], value: newVersion });
    }
    const pkgJsonPath = await updatePackageJson(dir, pkgJsonEdits);
    if (pkgJsonPath) {
      touchedFiles.push(pkgJsonPath);
    }

    if (changelog && changelog.length > 0) {
      const changelogPath = path.resolve(dir, "CHANGELOG.md");
      await updateChangelog(changelogPath, changelog, name);
      touchedFiles.push(changelogPath);
      filesToFormat.push(changelogPath);
    }
  }

  if (packages.rootPackage) {
    const pkgJsonEdits = getDependencyVersionEdits(
      packages.rootPackage.packageJson,
      versionsToUpdate,
      dependencyUpdateOptions,
    );

    const pkgJsonPath = await updatePackageJson(
      packages.rootPackage.dir,
      pkgJsonEdits,
    );
    if (pkgJsonPath) {
      touchedFiles.push(pkgJsonPath);
    }
  }

  if (filesToFormat.length > 0) {
    const formatter = await getFormatter(config.format, cwd);
    await formatter(filesToFormat);
  }

  if (releasePlan.preState == null || releasePlan.preState.mode === "exit") {
    const changesetFolder = path.resolve(cwd, ".changeset");
    await Promise.all(
      changesets.map(async (changeset) => {
        const changesetPath = path.resolve(
          changesetFolder,
          `${changeset.id}.md`,
        );
        if (
          await fs.access(changesetPath).then(
            () => true,
            () => false,
          )
        ) {
          // DO NOT remove changeset for skipped packages
          // Mixed changeset that contains both skipped packages and not skipped packages are disallowed
          // At this point, we know there is no such changeset, because otherwise the program would've already failed,
          // so we just check if any skipped package exists in this changeset, and only remove it if none exists
          // options to skip packages were added in v2, so we don't need to do it for v1 changesets
          if (
            !changeset.releases.some((release) =>
              shouldSkipPackage(packagesByName.get(release.name)!, {
                ignore: config.ignore,
                allowPrivatePackages: config.privatePackages.version,
              }),
            )
          ) {
            touchedFiles.push(changesetPath);
            await fs.rm(changesetPath, { recursive: true, force: true });
          }
        }
      }),
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
  contextDir: string,
) {
  if (!config.changelog) {
    return Promise.resolve(
      releasesWithPackage.map((release) => ({
        ...release,
        changelog: null,
      })),
    );
  }

  let getChangelogFuncs: ChangelogFunctions = {
    getReleaseLine: () => Promise.resolve(""),
    getDependencyReleaseLine: () => Promise.resolve(""),
  };

  const changelogOpts = config.changelog[1];
  const changesetPath = path.join(cwd, ".changeset");
  let changelogPath;

  try {
    changelogPath = importResolveFromDir(config.changelog[0], changesetPath);
  } catch {
    changelogPath = importResolveFromDir(config.changelog[0], contextDir);
  }

  let possibleChangelogFunc = await import(changelogPath);
  if (possibleChangelogFunc.default) {
    possibleChangelogFunc = possibleChangelogFunc.default;

    // Check nested default again in case it's CJS with `__esModule` interop
    if (possibleChangelogFunc.default) {
      possibleChangelogFunc = possibleChangelogFunc.default;
    }
  }
  if (
    typeof possibleChangelogFunc.getReleaseLine === "function" &&
    typeof possibleChangelogFunc.getDependencyReleaseLine === "function"
  ) {
    getChangelogFuncs = possibleChangelogFunc;
  } else {
    throw new Error("Could not resolve changelog generation functions");
  }

  const commits = await getCommitsThatAddChangesets(
    changesets.map((cs) => cs.id),
    cwd,
  );
  const moddedChangesets = changesets.map((cs, i) => ({
    ...cs,
    commit: commits[i],
  }));

  return Promise.all(
    releasesWithPackage.map(async (release) => {
      const changelog = await getChangelogEntry(
        cwd,
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
        },
      );

      return {
        ...release,
        changelog,
      };
    }),
  ).catch((e) => {
    console.error(
      "The following error was encountered while generating changelog entries",
    );
    console.error(
      "We have escaped applying the changesets, and no files should have been affected",
    );
    throw e;
  });
}

async function updateChangelog(
  changelogPath: string,
  changelog: string,
  name: string,
) {
  const templateString = `\n\n${changelog.trim()}\n`;
  let fileData;

  try {
    fileData = (await fs.readFile(changelogPath)).toString();
  } catch (err: any) {
    if (err?.code !== "ENOENT") {
      throw err;
    }
    await fs.writeFile(changelogPath, `# ${name}${templateString}`);
    return;
  }

  // if the file exists but doesn't have the header, we'll add it in
  if (!fileData) {
    const completelyNewChangelog = `# ${name}${templateString}`;
    await fs.writeFile(changelogPath, completelyNewChangelog);
    return;
  }

  // Require just 2 version numbers here, assuming `## 1.1` is a valid version heading.
  // Our version headings start with ##, we are more permissive here though.
  // Note: we also need to handle prerelease versions here but that's already covered by the regex.
  const isVersionHeading = /^#{1,6}\s+\d+\.\d+/.test(fileData);

  let newChangelog: string;
  if (isVersionHeading) {
    newChangelog = templateString.trimStart() + fileData;
  } else {
    const index = fileData.indexOf("\n");
    newChangelog =
      index === -1
        ? fileData + templateString // treat the whole file as header
        : fileData.slice(0, index) + templateString + fileData.slice(index + 1);
  }

  await fs.writeFile(changelogPath, newChangelog);
}

/** @deprecated Use named export `applyReleasePlan` instead */
const applyReleasePlanDefault = applyReleasePlan;
export default applyReleasePlanDefault;
