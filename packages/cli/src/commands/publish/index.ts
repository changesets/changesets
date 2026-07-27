import path, { resolve } from "node:path";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { readPreState } from "@changesets/pre";
import type { Package, PreState } from "@changesets/types";
import { log, progress, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import {
  isPublishFailure,
  isPublishSuccessful,
  npmPublishQueue,
} from "../../lib/common.ts";
import type { PublishResult, PublishTool } from "../../lib/types.ts";
import { importantWarning } from "../../utils/cli-utilities.ts";
import { createOutputReport } from "../../utils/output.ts";
import { readConfig } from "../../utils/read-config.ts";
import { createGitTags, formatGitTagResults } from "../git-tag/utils.ts";
import {
  getPublishPlan,
  readPlanFile,
  type TagReleaseEntry,
  type PublishReleaseEntry,
} from "../publish-plan/getPublishPlan.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { getPublishTool } from "./getPublishTool.ts";

type PublishQueueItem = {
  release: PublishReleaseEntry;
  result: PublishResult | undefined;
};

function formatPackageList(
  entry: (PublishResult | TagReleaseEntry)[],
  versionColor = c.green,
) {
  return entry
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const error =
        "result" in entry && isPublishFailure(entry)
          ? `\n${c.dim(`└`)} ${entry.code || "(no code)"}: ${entry.message || "Unknown error"}`
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

async function bulkPublishPackages({
  publishTool,
  publishQueue,
  packagesByName,
  artifactDir,
  otpCode,
  onResult,
}: {
  publishTool: PublishTool;
  publishQueue: PublishQueueItem[];
  packagesByName: Map<string, Package>;
  artifactDir?: string;
  otpCode: string | null;
  onResult?: (result: PublishResult) => void;
}): Promise<PublishQueueItem[]> {
  if (publishQueue.length === 0) return [];

  const publishPromises = publishQueue.map(async (item) => {
    const pkg = packagesByName.get(item.release.name)!;
    const result = await npmPublishQueue.add(() =>
      publishTool.publish({
        pkg,
        release: item.release,
        tarballPath: artifactDir
          ? resolve(artifactDir, item.release.tarball!.path)
          : null,
        interactive: false,
        otpCode,
      }),
    );

    onResult?.(result);
    return { release: item.release, result };
  });

  return Promise.all(publishPromises);
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

  let finishedCount = 0;
  const successfulNpmPublishes: PublishResult[] = [];
  const unsuccessfulNpmPublishes: PublishResult[] = [];

  const totalPublishCount: number = plan.reduce(
    (count, chunk) =>
      count + chunk.filter((release) => release.kind === "publish").length,
    0,
  );
  const gitTagReleases: TagReleaseEntry[] = [];
  const tagOnlyReleases = new Set<TagReleaseEntry>();

  let otpCode = publishTool.getOtpCode(options?.otp);
  // in TTY mode the first publish "checks" if the publish process requires interactive auth or not
  // on CI everything has to be configured in a way that allows automation so we can go straight to bulk publishing
  // similarly, when OTP is provided we can go straight to bulk publishing as well
  let sequential = process.stdin.isTTY && otpCode == null;

  const p = progress({ max: totalPublishCount });
  const renderProgressMessage = () =>
    finishedCount === 0
      ? "Publishing packages"
      : `Publishing packages (${finishedCount}/${totalPublishCount})`;
  const advanceProgress = () => {
    finishedCount++;
    p.advance(1, renderProgressMessage());
  };
  if (totalPublishCount > 0) {
    p.start(renderProgressMessage());
  }

  // Publish packages in chunks based on the package graph.
  publishChunks: for (const chunk of plan) {
    let publishQueue: PublishQueueItem[] = [];

    for (const release of chunk) {
      if (release.kind === "tag-only") {
        if (options?.gitTag ?? true) {
          gitTagReleases.push(release);
          tagOnlyReleases.add(release);
        }
        continue;
      }
      publishQueue.push({ release, result: undefined });
    }

    while (publishQueue.length > 0) {
      if (sequential) {
        const item = publishQueue.shift()!;
        let interactive = false;

        let result =
          item.result ??
          (await npmPublishQueue.add(() =>
            publishTool.publish({
              pkg: packagesByName.get(item.release.name)!,
              release: item.release,
              tarballPath: artifactDir
                ? path.resolve(artifactDir, item.release.tarball!.path)
                : null,
              interactive,
              otpCode,
            }),
          ));

        // retry publishing with interactive mode if we need 2fa
        while (result.result === "failed:needs-2fa") {
          // Don't pass a rejected OTP to the interactive retry or any
          // subsequent publish.
          otpCode = null;
          p.stop(
            `${c.blue(item.release.name)} requires 2FA verification to publish...`,
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
            interactive = true;
            result = await npmPublishQueue.add(() =>
              publishTool.publish({
                pkg: packagesByName.get(item.release.name)!,
                release: item.release,
                tarballPath: artifactDir
                  ? path.resolve(artifactDir, item.release.tarball!.path)
                  : null,
                interactive,
                otpCode: null,
              }),
            );
          }
        }

        advanceProgress();

        if (result.result === "failed:already-published") {
          // we don't trust this error to mean that the authentication works
          // this could be rejected by a preflight check (theoretically, we've not observed this in practice)
          // in general, we should *rarely* see this error as we only try to publish packages that have not been published yet
          if (finishedCount === totalPublishCount) {
            p.clear();
          } else if (interactive) {
            p.start(renderProgressMessage());
          }
          continue;
        }

        if (isPublishSuccessful(result)) {
          successfulNpmPublishes.push(result);

          // A successful non-interactive publish proves that bulk publishing is
          // currently possible. If 2FA becomes necessary again, bulk publishing
          // will hand the affected packages back to this sequential path.
          if (!interactive) {
            sequential = false;
          } else if (finishedCount < totalPublishCount) {
            // The interactive child owned the terminal, so publishing progress
            // was stopped while it ran. Resume it before publishing the next
            // package sequentially.
            p.start(renderProgressMessage());
          }
        }

        if (isPublishFailure(result)) {
          p.clear();
          unsuccessfulNpmPublishes.push(result);
          // note that other packages in this chunk could theoretically succeed but we bail out on the first hard failure
          break publishChunks;
        }

        continue;
      }

      const publishedItems = await bulkPublishPackages({
        publishTool,
        publishQueue,
        packagesByName,
        otpCode,
        artifactDir,
        onResult: (result) => {
          // those can be recovered in tty mode, so we don't want to advance the progress bar for them
          if (process.stdin.isTTY && result.result === "failed:needs-2fa") {
            return;
          }

          advanceProgress();
        },
      });

      const results = publishedItems.map((item) => item.result!);

      const successes = results.filter(isPublishSuccessful);
      successfulNpmPublishes.push(...successes);
      const failures = results.filter((result) => result.result === "failed");
      unsuccessfulNpmPublishes.push(...failures);

      const recoverableItems = publishedItems.filter(
        (item) => item.result!.result === "failed:needs-2fa",
      );
      if (failures.length > 0 || !process.stdin.isTTY) {
        // We could still retry the recoverable failures, but mixing recovery
        // with hard failures complicates the flow. Only recover when every
        // failure is recoverable; failed:already-published is acceptable here.
        unsuccessfulNpmPublishes.push(
          ...recoverableItems.map((item) => item.result!),
        );
        publishQueue = [];
        // Hard failures are always terminal. Without a TTY, 2FA failures are
        // terminal too because interactive recovery is unavailable.
        if (failures.length > 0 || recoverableItems.length > 0) {
          break publishChunks;
        }
        continue;
      }

      publishQueue = recoverableItems.map((item, index) => ({
        release: item.release,
        // The first failure can proceed directly to interactive recovery.
        // The remaining results become stale after authentication may change.
        result: index === 0 ? item.result : undefined,
      }));

      if (publishQueue.length > 0) {
        sequential = true;
        // Bulk publishing proved that the current OTP is absent or no longer
        // valid, so don't reuse it during sequential recovery.
        otpCode = null;
      }
    }
  }

  if (successfulNpmPublishes.length !== 0) {
    const message = `Successfully published:
${formatPackageList(successfulNpmPublishes)}`;

    if (sequential) {
      log.success(message);
    } else {
      p.stop(message);
    }

    if (options?.gitTag ?? true) {
      gitTagReleases.push(
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
  if (gitTagReleases.length > 0) {
    const p = spinner();
    p.start("Creating git tags...");

    const results = await createGitTags({
      packages,
      releases: gitTagReleases,
      reporter,
    });

    p.stop(
      formatGitTagResults(packages.tool, {
        tagged: results.tagged.filter((release) =>
          tagOnlyReleases.has(release),
        ),
        existing: results.existing,
      }),
    );
  }

  if (unsuccessfulNpmPublishes.length !== 0) {
    throw new ExitError(1);
  }
}
