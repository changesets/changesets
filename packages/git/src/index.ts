import fs from "node:fs/promises";
import path from "node:path";
import {
  getChangedCatalogEntries,
  parseCatalogProtocol,
  parseCatalogs,
  readCatalogs,
} from "@changesets/catalogs";
import { GitError } from "@changesets/errors";
import type { Package, Packages } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import picomatch from "picomatch";
import { exec } from "tinyexec";

export async function add(pathToFile: string, cwd: string) {
  const gitCmd = await exec("git", ["add", pathToFile], {
    nodeOptions: { cwd },
  });

  if (gitCmd.exitCode !== 0) {
    console.log(pathToFile, gitCmd.stderr.toString());
  }
  return gitCmd.exitCode === 0;
}

export async function commit(message: string, cwd: string) {
  const gitCmd = await exec("git", ["commit", "-m", message, "--allow-empty"], {
    nodeOptions: { cwd },
  });
  return gitCmd.exitCode === 0;
}

export async function getAllTags(cwd: string): Promise<Set<string>> {
  const gitCmd = await exec("git", ["tag"], { nodeOptions: { cwd } });

  if (gitCmd.exitCode !== 0) {
    throw new Error(gitCmd.stderr.toString());
  }

  const tags = gitCmd.stdout.toString().trim().split("\n");

  return new Set(tags);
}

// used to create a single tag at a time for the current head only
export async function tag(tagStr: string, cwd: string) {
  // NOTE: it's important we use the -m flag to create annotated tag otherwise 'git push --follow-tags' won't actually push
  // the tags
  const gitCmd = await exec("git", ["tag", tagStr, "-m", tagStr], {
    nodeOptions: { cwd },
  });
  return gitCmd.exitCode === 0;
}

// Find the commit where we diverged from `ref` at using `git merge-base`
export async function getDivergedCommit(cwd: string, ref: string) {
  const cmd = await exec("git", ["merge-base", ref, "HEAD"], {
    nodeOptions: { cwd },
  });
  if (cmd.exitCode !== 0) {
    throw new Error(
      `Failed to find where HEAD diverged from "${ref}". Does "${ref}" exist and it's synced with remote?`,
    );
  }
  return cmd.stdout.toString().trim();
}

/**
 * Get the SHAs for the commits that added files, including automatically
 * extending a shallow clone if necessary to determine any commits.
 * @param gitPaths - Paths to fetch
 * @param options - `cwd` and `short`
 */
export async function getCommitsThatAddFiles(
  gitPaths: string[],
  { cwd, short = false }: { cwd: string; short?: boolean },
): Promise<(string | undefined)[]> {
  // Maps gitPath to commit SHA
  const map = new Map<string, string>();

  // Paths we haven't completed processing on yet
  let remaining = gitPaths;

  do {
    // Fetch commit information for all paths we don't have yet
    const commitInfos = await Promise.all(
      remaining.map(async (gitPath: string) => {
        const [commitSha, parentSha] = (
          await exec(
            "git",
            [
              "log",
              "--diff-filter=A",
              "--follow",
              "--max-count=1",
              short ? "--pretty=format:%h:%p" : "--pretty=format:%H:%p",
              gitPath,
            ],
            { nodeOptions: { cwd } },
          )
        ).stdout
          .toString()
          .split(":");
        return { path: gitPath, commitSha, parentSha };
      }),
    );

    // To collect commits without parents (usually because they're absent from
    // a shallow clone).
    const commitsWithMissingParents = [];

    for (const info of commitInfos) {
      if (info.commitSha) {
        if (info.parentSha) {
          // We have found the parent of the commit that added the file.
          // Therefore we know that the commit is legitimate and isn't simply the boundary of a shallow clone.
          map.set(info.path, info.commitSha);
        } else {
          commitsWithMissingParents.push(info);
        }
      } else {
        // No commit for this file, which indicates it doesn't exist.
      }
    }

    if (commitsWithMissingParents.length === 0) {
      break;
    }

    // The commits we've found may be the real commits or they may be the boundary of
    // a shallow clone.

    // Can we deepen the clone?
    if (await isRepoShallow({ cwd })) {
      // Yes.
      await deepenCloneBy({ by: 50, cwd });
      remaining = commitsWithMissingParents.map((p) => p.path);
    } else {
      // It's not a shallow clone, so all the commit SHAs we have are legitimate.
      for (const unresolved of commitsWithMissingParents) {
        map.set(unresolved.path, unresolved.commitSha);
      }
      break;
    }
    // eslint-disable-next-line no-constant-condition
  } while (true);

  return gitPaths.map((p) => map.get(p));
}

export async function isRepoShallow({ cwd }: { cwd: string }) {
  const isShallowRepoOutput = (
    await exec("git", ["rev-parse", "--is-shallow-repository"], {
      nodeOptions: { cwd },
    })
  ).stdout
    .toString()
    .trim();

  if (isShallowRepoOutput === "--is-shallow-repository") {
    // We have an old version of Git (<2.15) which doesn't support `rev-parse --is-shallow-repository`
    // In that case, we'll test for the existence of .git/shallow.

    // Firstly, find the .git folder for the repo; note that this will be relative to the repo dir
    const gitDir = (
      await exec("git", ["rev-parse", "--git-dir"], { nodeOptions: { cwd } })
    ).stdout
      .toString()
      .trim();

    const fullGitDir = path.resolve(cwd, gitDir);

    // Check for the existence of <gitDir>/shallow
    try {
      await fs.access(path.join(fullGitDir, "shallow"));
      return true;
    } catch {
      return false;
    }
  } else {
    // We have a newer Git which supports `rev-parse --is-shallow-repository`. We'll use
    // the output of that instead of messing with .git/shallow in case that changes in the future.
    return isShallowRepoOutput === "true";
  }
}

export async function deepenCloneBy({ by, cwd }: { by: number; cwd: string }) {
  const cmd = await exec("git", ["fetch", `--deepen=${by}`], {
    nodeOptions: { cwd },
  });
  if (cmd.exitCode !== 0) {
    throw new Error(cmd.stderr.toString());
  }
}
async function getRepoRoot({ cwd }: { cwd: string }) {
  const { stdout, exitCode, stderr } = await exec(
    "git",
    ["rev-parse", "--show-cdup"],
    { nodeOptions: { cwd } },
  );

  if (exitCode !== 0) {
    throw new Error(stderr.toString());
  }

  return path.resolve(cwd, stdout.toString().trim().replace(/\n|\r/g, ""));
}

export async function getChangedFilesSince({
  cwd,
  ref,
  fullPath = false,
}: {
  cwd: string;
  ref: string;
  fullPath?: boolean;
}): Promise<Array<string>> {
  const divergedAt = await getDivergedCommit(cwd, ref);
  // Now we can find which files we added
  const cmd = await exec(
    "git",
    ["diff", "--name-only", "--no-relative", divergedAt],
    { nodeOptions: { cwd } },
  );
  if (cmd.exitCode !== 0) {
    throw new Error(
      `Failed to diff against ${divergedAt}. Is ${divergedAt} a valid ref?`,
    );
  }

  const files = cmd.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((a) => a);
  if (!fullPath) return files;

  const repoRoot = await getRepoRoot({ cwd });
  return files.map((file) => path.resolve(repoRoot, file));
}

// below are less generic functions that we use in combination with other things we are doing
export async function getChangedChangesetFilesSinceRef({
  cwd,
  ref,
}: {
  cwd: string;
  ref: string;
}): Promise<Array<string>> {
  try {
    const divergedAt = await getDivergedCommit(cwd, ref);
    // Now we can find which files we added
    const cmd = await exec(
      "git",
      ["diff", "--name-only", "--diff-filter=d", "--no-relative", divergedAt],
      {
        nodeOptions: { cwd },
      },
    );

    const rootChangesetsRegex = /\.changeset\/[^/]+\.md$/;
    const preChangesetsRegex = /\.changeset\/pre\/[^/]+\.md$/;

    const files = cmd.stdout
      .toString()
      .trim()
      .split("\n")
      .filter(
        (file) =>
          rootChangesetsRegex.test(file) || preChangesetsRegex.test(file),
      );
    return files;
  } catch (err) {
    if (err instanceof GitError) return [];
    throw err;
  }
}

export async function getChangedPackagesSinceRef({
  cwd,
  ref,
  changedFilePatterns = ["**"],
  detectCatalogChanges = true,
}: {
  cwd: string;
  ref: string;
  changedFilePatterns?: readonly string[];
  detectCatalogChanges?: boolean;
}): Promise<Package[]> {
  const changedFiles = await getChangedFilesSince({ ref, cwd, fullPath: true });
  const packages = await getPackages(cwd);

  const packagesWithChangedCatalogEntries = detectCatalogChanges
    ? await getPackagesWithChangedCatalogEntries({
        cwd,
        ref,
        packages,
        changedFiles,
        changedFilePatterns,
      })
    : new Set<string>();

  return packages.packages
    .toSorted((pkgA, pkgB) => pkgB.dir.length - pkgA.dir.length)
    .filter((pkg) => {
      const changedPackageFiles: string[] = [];

      for (let i = changedFiles.length - 1; i >= 0; i--) {
        const file = changedFiles[i];
        const isFileInPkg = !path.relative(pkg.dir, file).startsWith("..");
        if (isFileInPkg) {
          changedFiles.splice(i, 1);
          const relativeFile = file.slice(pkg.dir.length + 1);
          changedPackageFiles.push(relativeFile);
        }
      }

      return (
        packagesWithChangedCatalogEntries.has(pkg.packageJson.name) ||
        (changedPackageFiles.length > 0 &&
          globMatchSome(changedPackageFiles, changedFilePatterns))
      );
    });
}

const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

async function getPackagesWithChangedCatalogEntries({
  cwd,
  ref,
  packages,
  changedFiles,
  changedFilePatterns,
}: {
  cwd: string;
  ref: string;
  packages: Packages;
  changedFiles: readonly string[];
  changedFilePatterns: readonly string[];
}): Promise<Set<string>> {
  const changed = new Set<string>();

  // A catalog entry replaces a range in each package.json referencing it,
  // so a config that excludes package.json should exclude catalog updates too
  if (!globMatchSome(["package.json"], changedFilePatterns)) {
    return changed;
  }

  const catalogs = await readCatalogs(packages.rootDir);

  if (!catalogs.source) {
    return changed;
  }

  const catalogPath = path.resolve(packages.rootDir, catalogs.source.filePath);

  if (!changedFiles.includes(catalogPath)) {
    return changed;
  }

  const repoRoot = await getRepoRoot({ cwd });
  const previousContents = await getFileContentsAtRef({
    cwd,
    ref: await getDivergedCommit(cwd, ref),
    filePath: path.relative(repoRoot, catalogPath).replace(/\\/g, "/"),
  });

  const changedEntries = getChangedCatalogEntries(
    previousContents == null
      ? new Map()
      : parseCatalogs(previousContents, catalogs.source.format),
    catalogs.entries,
  );

  if (changedEntries.length === 0) {
    return changed;
  }

  for (const pkg of packages.packages) {
    const referencesChangedEntry = changedEntries.some(
      ({ catalogName, dependencyName }) =>
        DEPENDENCY_TYPES.some((depType) => {
          const range = pkg.packageJson[depType]?.[dependencyName];

          return range != null && parseCatalogProtocol(range) === catalogName;
        }),
    );

    if (referencesChangedEntry) {
      changed.add(pkg.packageJson.name);
    }
  }

  return changed;
}

async function getFileContentsAtRef({
  cwd,
  ref,
  filePath,
}: {
  cwd: string;
  ref: string;
  filePath: string;
}): Promise<string | undefined> {
  const cmd = await exec("git", ["show", `${ref}:${filePath}`], {
    nodeOptions: { cwd },
  });

  // A non-zero exit code means the file didn't exist at that ref
  return cmd.exitCode === 0 ? cmd.stdout.toString() : undefined;
}

export async function tagExists(tagStr: string, cwd: string) {
  const gitCmd = await exec("git", ["tag", "-l", tagStr], {
    nodeOptions: { cwd },
  });
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}

export async function getCurrentCommitId({
  cwd,
  short = false,
}: {
  cwd: string;
  short?: boolean;
}): Promise<string> {
  return (
    await exec(
      "git",
      ["rev-parse", short && "--short", "HEAD"].filter<string>(Boolean as any),
      { nodeOptions: { cwd } },
    )
  ).stdout
    .toString()
    .trim();
}

export async function remoteTagExists(tagStr: string) {
  const gitCmd = await exec("git", [
    "ls-remote",
    "--tags",
    "origin",
    "-l",
    tagStr,
  ]);
  const output = gitCmd.stdout.toString().trim();
  const tagExists = !!output;
  return tagExists;
}

function globMatchSome(
  paths: readonly string[],
  patterns?: readonly string[],
): boolean {
  if (!patterns) return paths.length > 0;

  const matchers = patterns.map((p) => picomatch(p, undefined, true));
  return paths.some((path) => {
    if (path.includes("\\")) {
      path = path.replace(/\\/g, "/");
    }

    let passed = false;
    for (const matcher of matchers) {
      if (!passed) {
        // If not passed yet, only match positive matches
        if (!matcher.state.negated && matcher(path)) {
          passed = true;
        }
      } else {
        // If passed, only match negative/negated matches
        if (matcher.state.negated && !matcher(path)) {
          passed = false;
        }
      }
    }
    return passed;
  });
}
