import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import type { PreState } from "@changesets/types";
import { log, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getPublishPlan, type TagReleaseEntry } from "../publish-plan/getPublishPlan.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { publishPackages } from "./publishPackages.ts";

function formatPackageList(
  pkgs: Array<{ name: string; version: string }>,
  versionColor = c.green,
) {
  return pkgs
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((p) => `${c.blueBright(p.name)}@${versionColor(p.version)}`)
    .join("\n");
}

function showNonLatestTagWarning(tag?: string, preState?: PreState) {
  if (preState) {
    importantWarning(
      `
You are in prerelease mode, so packages will be published to the ${c.cyan(preState.tag)} npm tag,
${c.red("except")} for packages that have not had normal releases, which will be published to ${c.cyan("latest")}.
      `,
    );
  } else if (tag !== "latest") {
    log.warn(`Packages will be released under the ${tag} tag.`);
  }
}

export interface PublishOptions {
  cwd?: string;
  otp?: string;
  tag?: string;
  /** @default true */
  gitTag?: boolean;
}

export async function publish(options?: PublishOptions) {
  const cwd = options?.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);

  const releaseTag =
    options?.tag && options.tag.length > 0 ? options.tag : undefined;
  const preState = await readPreState(packages.rootDir);

  if (releaseTag && preState && preState.mode === "pre") {
    log.error(
      `
Releasing under custom tag is not allowed in pre mode!
To resolve this exit the pre mode by running ${c.cyan("changeset pre exit")}.
      `.trim(),
    );
    throw new ExitError(1);
  }

  if (releaseTag || preState) {
    showNonLatestTagWarning(options?.tag, preState);
  }

  const config = await readConfig(packages);
  const plan = await getPublishPlan(packages.rootDir, config, {
    tag: releaseTag,
  });
  const entries = plan.flat();
  const unpublishedPackages = entries.filter(
    (release) => release.kind === "publish",
  );
  const untaggedPrivatePackageReleases = entries.filter(
    (release): release is TagReleaseEntry => release.kind === "tag-only",
  );

  const publishedPackages = await publishPackages({
    releases: unpublishedPackages,
    packages: packages.packages,
    otp: options?.otp,
  });

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
    if (options?.gitTag ?? true) {
      const p = spinner();
      p.start(
        `Creating git tag${successfulNpmPublishes.length > 1 ? "s" : ""}...`,
      );
      await tagPublish(
        packages.tool.type,
        successfulNpmPublishes,
        packages.rootDir,
      );
      p.stop(`Created git tag${successfulNpmPublishes.length > 1 ? "s" : ""}.`);
    }
  }

  if (untaggedPrivatePackageReleases.length > 0) {
    log.success(
      `
Found untagged packages:
${formatPackageList(untaggedPrivatePackageReleases, c.yellowBright)}
      `.trim(),
    );

    const p = spinner();
    p.start(
      `Creating git tag${untaggedPrivatePackageReleases.length > 1 ? "s" : ""}...`,
    );
    await tagPublish(
      packages.tool.type,
      untaggedPrivatePackageReleases,
      packages.rootDir,
    );
    p.stop(
      `Created git tag${untaggedPrivatePackageReleases.length > 1 ? "s" : ""}.`,
    );
  }

  if (unsuccessfulNpmPublishes.length > 0) {
    log.error(
      `
Some packages failed to publish:
${formatPackageList(unsuccessfulNpmPublishes, c.red)}
      `.trim(),
    );
    throw new ExitError(1);
  }
}

async function tagPublish(
  tool: string,
  packageReleases: Array<{ name: string; version: string }>,
  cwd: string,
) {
  if (tool !== "root") {
    for (const pkg of packageReleases) {
      const tag = `${pkg.name}@${pkg.version}`;
      await git.tag(tag, cwd);
    }
  } else {
    const tag = `v${packageReleases[0].version}`;
    await git.tag(tag, cwd);
  }
}
