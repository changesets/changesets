import path from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import type { PreState } from "@changesets/types";
import { log, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { createOutputReport, type OutputReporter } from "../../utils/output.ts";
import { readConfig } from "../../utils/read-config.ts";
import {
  getPublishPlan,
  readPlanFile,
} from "../publish-plan/getPublishPlan.ts";
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
  fromPackDir?: string;
  output?: string;
  /** @default true */
  gitTag?: boolean;
}

export async function publish(options?: PublishOptions) {
  await using reporter = await createOutputReport(options?.output);
  const cwd = options?.cwd ?? process.cwd();
  const artifactDir = options?.fromPackDir
    ? path.resolve(cwd, options.fromPackDir)
    : undefined;

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);

  const releaseTag =
    options?.tag && options.tag.length > 0 ? options.tag : undefined;
  const preState = !artifactDir
    ? await readPreState(packages.rootDir)
    : undefined;

  if (artifactDir && releaseTag) {
    log.error("Releasing under custom tag is not allowed in artifact mode.");
    throw new ExitError(1);
  }

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
  const plan = artifactDir
    ? await readPlanFile(path.join(artifactDir, "publish-plan.json"))
    : await getPublishPlan(packages.rootDir, config, {
        tag: releaseTag,
      });
  if (plan.length === 0) {
    log.warn("No unpublished projects to publish.");
    return;
  }

  for (let index = 0; index < plan.length; index++) {
    const chunk = plan[index];

    if (plan.length > 1) {
      log.info(`Publishing group ${index + 1} of ${plan.length}...`);
    }

    const unpublishedPackages = chunk.filter(
      (release) => release.kind === "publish",
    );
    const untaggedPrivatePackageReleases = chunk.filter(
      (release) => release.kind === "tag-only",
    );
    const publishedPackages =
      unpublishedPackages.length > 0
        ? await publishPackages({
            releases: unpublishedPackages,
            packages,
            artifactDir,
            otp: options?.otp,
          })
        : [];
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
          packages.rootDir,
          reporter,
          packages.tool.type,
          successfulNpmPublishes,
        );
        p.stop(
          `Created git tag${successfulNpmPublishes.length > 1 ? "s" : ""}.`,
        );
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
        packages.rootDir,
        reporter,
        packages.tool.type,
        untaggedPrivatePackageReleases,
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
}

async function tagPublish(
  cwd: string,
  reporter: OutputReporter | undefined,
  tool: string,
  packageReleases: Array<{ name: string; version: string }>,
) {
  if (tool !== "root") {
    for (const pkg of packageReleases) {
      const tag = `${pkg.name}@${pkg.version}`;
      await git.tag(tag, cwd);
      reporter?.write({
        type: "git-tag",
        tag,
        packageName: pkg.name,
      });
    }
  } else {
    const tag = `v${packageReleases[0].version}`;
    await git.tag(tag, cwd);
    reporter?.write({
      type: "git-tag",
      tag,
      packageName: packageReleases[0].name,
    });
  }
}
