import publishPackages from "./publishPackages.ts";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import type { Config, PreState } from "@changesets/types";
import { log, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import pc from "picocolors";
import { getUntaggedPackages } from "../../utils/getUntaggedPackages.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";

function formatPackageList(
  pkgs: Array<{ name: string; newVersion: string }>,
  versionColor = pc.green,
) {
  return pkgs
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((p) => `${pc.blueBright(p.name)}@${versionColor(p.newVersion)}`)
    .join("\n");
}

function showNonLatestTagWarning(tag?: string, preState?: PreState) {
  if (preState) {
    importantWarning(
      `
You are in prerelease mode, so packages will be published to the ${pc.cyan(preState.tag)} npm tag,
${pc.red("except")} for packages that have not had normal releases, which will be published to ${pc.cyan("latest")}.
      `,
    );
  } else if (tag !== "latest") {
    log.warn(`Packages will be released under the ${tag} tag.`);
  }
}

export default async function publish(
  cwd: string,
  { otp, tag, gitTag = true }: { otp?: string; tag?: string; gitTag?: boolean },
  config: Config,
) {
  const releaseTag = tag && tag.length > 0 ? tag : undefined;
  let preState = await readPreState(cwd);

  if (releaseTag && preState && preState.mode === "pre") {
    log.error(
      `
Releasing under custom tag is not allowed in pre mode!
To resolve this exit the pre mode by running ${pc.cyan("changeset pre exit")}.
      `.trim(),
    );
    throw new ExitError(1);
  }

  if (releaseTag || preState) {
    showNonLatestTagWarning(tag, preState);
  }

  const { packages, tool } = await getPackages(cwd);
  const tagPrivatePackages =
    config.privatePackages && config.privatePackages.tag;

  const publishedPackages = await publishPackages({
    packages,
    // if not public, we won't pass the access, and it works as normal
    access: config.access,
    otp,
    preState,
    tag: releaseTag,
  });

  const privatePackages = packages.filter(
    (pkg) => pkg.packageJson.private && pkg.packageJson.version,
  );
  const untaggedPrivatePackageReleases = tagPrivatePackages
    ? await getUntaggedPackages(privatePackages, cwd, tool)
    : [];

  if (
    publishedPackages.length === 0 &&
    untaggedPrivatePackageReleases.length === 0
  ) {
    log.warn("No unpublished projects to publish.");
  }

  const successfulNpmPublishes = publishedPackages.filter(
    (p) => p.result === "published",
  );
  const unsuccessfulNpmPublishes = publishedPackages.filter(
    (p) => p.result === "failed",
  );

  if (successfulNpmPublishes.length > 0) {
    log.success(
      `
Successfully published:
${formatPackageList(successfulNpmPublishes)}
      `.trim(),
    );

    // We create the tags after the push above so that we know that HEAD won't change and that pushing
    // won't suffer from a race condition if another merge happens in the mean time (pushing tags won't
    // fail if we are behind the base branch).
    if (gitTag) {
      const p = spinner();
      p.start(
        `Creating git tag${successfulNpmPublishes.length > 1 ? "s" : ""}...`,
      );
      await tagPublish(tool.type, successfulNpmPublishes, cwd);
      p.stop(`Created git tag${successfulNpmPublishes.length > 1 ? "s" : ""}.`);
    }
  }

  if (untaggedPrivatePackageReleases.length > 0) {
    log.success(
      `
Found untagged packages:
${formatPackageList(untaggedPrivatePackageReleases, pc.yellowBright)}
      `.trim(),
    );

    const p = spinner();
    p.start(
      `Creating git tag${untaggedPrivatePackageReleases.length > 1 ? "s" : ""}...`,
    );
    await tagPublish(tool.type, untaggedPrivatePackageReleases, cwd);
    p.stop(
      `Created git tag${untaggedPrivatePackageReleases.length > 1 ? "s" : ""}.`,
    );
  }

  if (unsuccessfulNpmPublishes.length > 0) {
    log.error(
      `
Some packages failed to publish:
${formatPackageList(unsuccessfulNpmPublishes, pc.red)}
      `.trim(),
    );
    throw new ExitError(1);
  }
}

async function tagPublish(
  tool: string,
  packageReleases: Array<{ name: string; newVersion: string }>,
  cwd: string,
) {
  if (tool !== "root") {
    for (const pkg of packageReleases) {
      const tag = `${pkg.name}@${pkg.newVersion}`;
      await git.tag(tag, cwd);
    }
  } else {
    const tag = `v${packageReleases[0].newVersion}`;
    await git.tag(tag, cwd);
  }
}
