import path from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { readPreState } from "@changesets/pre";
import type { PreState } from "@changesets/types";
import { log, progress, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import {
  buildGitTag,
  createGitTags,
  formatGitTagResults,
} from "../../actions/git-tag.ts";
import {
  isPublishFailure,
  isPublishSuccessful,
  NPM_PUBLISH_CONCURRENCY_LIMIT,
  npmPublishQueue,
} from "../../lib/common.ts";
import type { PublishResult } from "../../lib/types.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { createOutputReport } from "../../utils/output.ts";
import { readConfig } from "../../utils/read-config.ts";
import {
  getPublishPlan,
  type PublishReleaseEntry,
  readPlanFile,
  type TagReleaseEntry,
} from "../publish-plan/getPublishPlan.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { getPublishTool } from "./npm-utils.ts";
import { bulkPublishPackages } from "./publishPackages.ts";

function uniqBy<T>(array: T[], key: (t: T) => string) {
  const seen = new Set<string>();
  return array.filter((item) => {
    const k = key(item);
    if (seen.has(k)) {
      return false;
    }
    seen.add(k);
    return true;
  });
}

function formatPackageList(
  entry: (PublishResult | TagReleaseEntry)[],
  versionColor = c.green,
) {
  return entry
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const error =
        "result" in entry && isPublishFailure(entry)
          ? `\n${c.dim(`└`)} ${entry.summary}`
          : "";

      return `${c.blueBright(entry.name)}@${versionColor(entry.version)}${error}`;
    })
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
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );
  const publishTool = await getPublishTool(packages);
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

  // three stages
  // one where we step through each package until we know we don't need user interaction
  // second where we chunk publish any remaining packages in chunks
  // third where we create git tags

  npmPublishQueue.setConcurrency(1);

  const finishedPackages = new Set<string>();
  const successfulNpmPublishes: PublishResult[] = [];
  const unsuccessfulNpmPublishes: PublishResult[] = [];

  const publishPlan = plan.map((chunk) =>
    chunk.filter((plan) => plan.kind === "publish"),
  );
  const totalPublishCount: number = plan.reduce(
    (count, chunk) =>
      count + chunk.filter((release) => release.kind === "publish").length,
    0,
  );
  const gitTagsToCreate = plan.flatMap((chunk) =>
    chunk.filter((plan) => plan.kind === "tag-only"),
  );

  const otpCode = publishTool.getOtpCode(options?.otp);

  // if we have an otpCode we can skip the interactive handling
  if (otpCode == null) {
    // publish each package one-by-one until we see that we no longer need user interaction.
    // there's no reason to run chunk-publishing until then,
    // since the user will have to do 2FA between each publish anyways
    root: for (const chunk of publishPlan) {
      for (const plan of chunk) {
        const s = spinner();
        s.start(`Publishing packages...`);

        let result = await publishTool.publish({
          pkg: packagesByName.get(plan.name)!,
          release: plan,
          tarballPath: artifactDir
            ? path.resolve(artifactDir, plan.tarball!.path)
            : null,
          interactive: false,
          otpCode,
        });

        // retry publishing with interactive mode if we need 2fa
        while (result.result === "failed:needs-2fa") {
          s.stop(
            `${c.blue(plan.name)} requires 2FA verification to publish...`,
          );

          if (totalPublishCount >= 2) {
            importantWarning(
              c.italic(
                `
Make sure to check the "skip 2fa for 5 minutes" option to not have to do this
for every package being published after this!
                `.trim(),
              ),
            );
          }

          // if we have what we need, run 2fa in-process
          // TODO: implement in follow-up PR
          // @ts-expect-error: temporary exception
          // eslint-disable-next-line no-constant-binary-expression,no-constant-condition
          if (false && result.authUrl != null && result.doneUrl != null) {
            // await handle2fa(result);
          } else {
            // run publish again in TTY mode, the user handle 2fa for us
            result = await publishTool.publish({
              pkg: packagesByName.get(plan.name)!,
              release: plan,
              tarballPath: artifactDir
                ? path.resolve(artifactDir, plan.tarball!.path)
                : null,
              interactive: true,
              otpCode,
            });
          }
        }

        finishedPackages.add(plan.name);

        if (result.result === "failed:already-published") {
          // we don't trust this error to mean that the authentication works
          // this could be rejected by a preflight check (theoretically, we've not observed this in practice)
          // in general, we should *rarely* see this error as we only try to publish packages that have not been published yet
          s.clear();
          continue;
        }

        if (isPublishSuccessful(result)) {
          // clear this spinner from logs so it will seamlessly be replaced
          // by the next spinner in the one-by-one or bulk publishing
          s.clear();
          successfulNpmPublishes.push(result);

          // if a publish is successful without interactive mode, we should be able
          // to continue to bulk publishing
          if (result.result === "published") {
            break root;
          }
        }

        if (isPublishFailure(result)) {
          s.error(`Failed to publish ${c.blue(plan.name)}: ${result.summary}`);
          throw new ExitError(1);
        }
      }
    }
  }

  // bulk publishing

  const p = progress({ max: totalPublishCount });
  p.advance(finishedPackages.size);
  p.start("Publishing packages...");

  npmPublishQueue.setConcurrency(NPM_PUBLISH_CONCURRENCY_LIMIT);

  // publish packages in chunks based on package graph
  for (const chunk of plan) {
    const unpublishedPackages = chunk.filter(
      (release): release is PublishReleaseEntry =>
        !finishedPackages.has(release.name),
    );
    if (unpublishedPackages.length === 0) continue;

    const results = await bulkPublishPackages({
      publishTool,
      releases: unpublishedPackages,
      packagesByName,
      otp: options?.otp,
      artifactDir,
      onResult: ({ packageJson }) => {
        finishedPackages.add(packageJson.name);
        p.advance(
          1,
          `Publishing packages (${finishedPackages.size}/${totalPublishCount})`,
        );
      },
    });

    successfulNpmPublishes.push(...results.filter(isPublishSuccessful));
    unsuccessfulNpmPublishes.push(...results.filter(isPublishFailure));
  }

  if (successfulNpmPublishes.length !== 0) {
    p.stop(
      `
Successfully published:
${formatPackageList(successfulNpmPublishes)}
      `.trim(),
    );

    if (options?.gitTag ?? true) {
      gitTagsToCreate.push(
        ...successfulNpmPublishes.map((result) => ({
          kind: "tag-only" as const,
          ...result,
        })),
      );
    }
  } else {
    p.clear();
  }

  if (unsuccessfulNpmPublishes.length !== 0) {
    log.error(
      `
Some packages failed to publish:
${formatPackageList(unsuccessfulNpmPublishes, c.red)}
      `.trim(),
    );
  }

  // finally, create git tags as plan instructs
  const tagsToCreate = uniqBy(gitTagsToCreate, (r) =>
    buildGitTag(packages.tool, r),
  );
  if (tagsToCreate.length > 0 && process.env.CHANGESETS_FAKE_PUBLISH == null) {
    const p = spinner();
    p.start("Creating git tags...");

    const results = await createGitTags({
      config,
      packages,
      plan: tagsToCreate,
      reporter,
    });

    p.stop(formatGitTagResults(packages.tool, results));
  }

  if (unsuccessfulNpmPublishes.length !== 0) {
    throw new ExitError(1);
  }
}
