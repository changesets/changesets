import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getPublishPlan, type PublishPlan } from "../publish-plan/getPublishPlan.ts";
import { getPublishTool } from "../publish/npm-utils.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface PackOptions {
  cwd?: string;
  from?: string;
}

export interface PackedRelease {
  name: string;
  version: string;
  tarballFilename: string;
}

function getTarballFilename(stdout: string) {
  const json = getLastJsonObjectFromString(stdout);
  return Array.isArray(json) ? json[0]?.filename : json?.filename;
}

export async function pack(
  options?: PackOptions,
): Promise<Array<PackedRelease>> {
  const cwd = options?.cwd ?? process.cwd();
  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const plan = options?.from
    ? (JSON.parse(
        await fs.readFile(path.resolve(cwd, options.from), "utf8"),
      ) as PublishPlan)
    : await getPublishPlan(packages.rootDir, config);

  const releases = plan.flat().filter((release) => release.kind === "publish");

  if (releases.length === 0) {
    log.info("No packages to pack.");
    return [];
  }

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "changesets-pack-"));
  const queue = createPromiseQueue(5);
  const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));

  const packedReleases = await Promise.all(
    releases.map((release) =>
      queue.add(async (): Promise<PackedRelease> => {
        const pkg = packagesByName.get(release.name);

        if (!pkg) {
          throw new Error(`Package not found: ${release.name}`);
        }

        const publishTool = await getPublishTool(pkg.dir);
        const publishDir = pkg.packageJson.publishConfig?.directory
          ? path.resolve(pkg.dir, pkg.packageJson.publishConfig.directory)
          : pkg.dir;
        const args =
          publishTool.name === "pnpm"
            ? ["pack", "--json", "--pack-destination", outputDir]
            : ["pack", publishDir, "--json", "--pack-destination", outputDir];
        const execCwd = publishTool.name === "pnpm" ? publishDir : pkg.dir;
        const { exitCode, stdout, stderr } = await exec(
          publishTool.name,
          args,
          { nodeOptions: { cwd: execCwd } },
        );

        if (exitCode !== 0) {
          const json =
            getLastJsonObjectFromString(stderr.toString()) ||
            getLastJsonObjectFromString(stdout.toString());

          if (json?.error) {
            log.error(
              `An error occurred while packing ${release.name}: ${json.error.code}`,
            );
          } else if (stderr.toString()) {
            log.error(stderr.toString());
          } else {
            log.error(stdout.toString());
          }
          throw new ExitError(1);
        }

        const tarballFilename = getTarballFilename(stdout.toString());

        if (!tarballFilename) {
          throw new Error(`Failed to determine tarball filename for ${release.name}`);
        }

        return {
          name: release.name,
          version: release.version,
          tarballFilename,
        };
      }),
    ),
  );

  const tarballFilenamesByRelease = new Map(
    packedReleases.map((release) => [
      `${release.name}@${release.version}`,
      release.tarballFilename,
    ]),
  );
  const packedPlan = plan.map((group) =>
    group.map((release) => {
      if (release.kind !== "publish") {
        return release;
      }

      return {
        ...release,
        tarballFilename: tarballFilenamesByRelease.get(
          `${release.name}@${release.version}`,
        ),
      };
    }),
  );

  await fs.writeFile(
    path.join(outputDir, "publish-plan.json"),
    JSON.stringify(packedPlan, undefined, 2),
  );

  log.info(
    `
Packed packages:
${packedReleases.map((release) => `- ${release.name}@${release.version}`).join("\n")}
    `.trim(),
  );

  return packedReleases;
}
