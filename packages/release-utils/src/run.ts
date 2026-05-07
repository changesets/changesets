import { createRequire } from "node:module";
import path from "node:path";
import type { Package } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import semverLt from "semver/functions/lt.js";
import { exec } from "tinyexec";
import * as gitUtils from "./gitUtils.ts";
import { readChangesetState } from "./readChangesetState.ts";
import { getChangedPackages, getVersionsByDirectory } from "./utils.ts";

const require = createRequire(import.meta.url);

type PublishOptions = {
  command: string;
  args?: string[];
  cwd?: string;
};

type PublishedPackage = { name: string; version: string };

type PublishResult =
  | {
      published: true;
      publishedPackages: PublishedPackage[];
    }
  | {
      published: false;
    };

export async function runPublish({
  command,
  args = [],
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  const branch = await gitUtils.getCurrentBranch(cwd);

  const { stdout: changesetPublishOutput } = await exec(command, args, {
    nodeOptions: { cwd },
  });

  await gitUtils.pullBranch(branch, cwd);
  await gitUtils.push(branch, { includeTags: true, cwd });

  const { packages, tool } = await getPackages(cwd);
  const releasedPackages: Package[] = [];

  if (tool.type !== "root") {
    const newTagRegex = /New tag:\s+(@[^/]+\/[^@]+|[^/]+)@(\S+)/;
    const packagesByName = new Map(
      packages.map((x) => [x.packageJson.name, x]),
    );

    for (const line of changesetPublishOutput.split("\n")) {
      const match = line.match(newTagRegex);
      if (match == null) {
        continue;
      }
      const pkgName = match[1];
      const pkg = packagesByName.get(pkgName);
      if (pkg == null) {
        throw new Error(
          `Package "${pkgName}" not found.` +
            "This is probably a bug in the action, please open an issue",
        );
      }
      releasedPackages.push(pkg);
    }
  } else {
    if (packages.length === 0) {
      throw new Error(
        `No package found.` +
          "This is probably a bug in the action, please open an issue",
      );
    }
    const pkg = packages[0];
    const newTagRegex = /New tag:/;

    for (const line of changesetPublishOutput.split("\n")) {
      const match = line.match(newTagRegex);

      if (match) {
        releasedPackages.push(pkg);
        break;
      }
    }
  }

  if (releasedPackages.length) {
    return {
      published: true,
      publishedPackages: releasedPackages.map((pkg) => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
      })),
    };
  }

  return { published: false };
}

type VersionOptions = {
  script?: string;
  cwd?: string;
  commitMessage?: string;
};

export async function runVersion({
  script,
  cwd = process.cwd(),
  commitMessage = "Version Packages",
}: VersionOptions) {
  const branch = await gitUtils.getCurrentBranch(cwd);
  const versionBranch = `changeset-release/${branch}`;
  const { preState } = await readChangesetState(cwd);

  await gitUtils.switchToMaybeExistingBranch(versionBranch, cwd);
  await gitUtils.reset("HEAD", undefined, cwd);

  const versionsByDirectory = await getVersionsByDirectory(cwd);

  if (script) {
    await exec(script, [], { nodeOptions: { cwd } });
  } else {
    const changesetsCliPkgJsonPath = require.resolve(
      "@changesets/cli/package.json",
      {
        paths: [cwd],
      },
    );
    const args = [];
    // this is done just so our tests can run with the types stripped since they are run with source files
    // this won't be used by published package since this file will be compiled there
    if (import.meta.url.endsWith(".ts")) {
      args.push("--experimental-strip-types");
    }
    args.push(path.join(path.dirname(changesetsCliPkgJsonPath), "bin.js"));
    args.push(
      semverLt(require(changesetsCliPkgJsonPath).version, "2.0.0")
        ? "bump"
        : "version",
    );
    await exec("node", args, { nodeOptions: { cwd } });
  }

  const changedPackages = await getChangedPackages(cwd, versionsByDirectory);

  // project with `commit: true` setting could have already committed files
  if (!(await gitUtils.checkIfClean(cwd))) {
    const finalCommitMessage = `${commitMessage}${
      preState ? ` (${preState.tag})` : ""
    }`;
    await gitUtils.commitAll(finalCommitMessage, cwd);
  }

  await gitUtils.push(versionBranch, { force: true, cwd });
  return { versionBranch, changedPackages };
}
