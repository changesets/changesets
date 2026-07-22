import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import c from "@changesets/color";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getDefaultWorkspaceConcurrency } from "../../utils/workspaceConcurrency.ts";
import {
  CURRENT_PUBLISH_PLAN_VERSION,
  getPublishPlan,
  readPlanFile,
  type TarballMetadata,
} from "../publish-plan/getPublishPlan.ts";
import { getPublishTool } from "../publish/getPublishTool.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface PackOptions {
  cwd?: string;
  fromPublishPlan?: string;
  outDir: string;
}

export interface PackedRelease {
  name: string;
  version: string;
  tarball: TarballMetadata;
}

function getNormalizedTarballFilename(name: string, version: string) {
  // based on https://github.com/pnpm/pnpm/blob/ddbb4899c252efabce5bbf4e519df83c07b891bf/pnpm11/releasing/commands/src/publish/pack.ts#L261
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function getIntegrity(filePath: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return `sha256-${hash.digest("base64")}`;
}

export async function pack(options: PackOptions) {
  const cwd = options.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const plan = options.fromPublishPlan
    ? await readPlanFile(path.resolve(cwd, options.fromPublishPlan))
    : await getPublishPlan(packages.rootDir, config);

  const outputDir = path.resolve(cwd, options.outDir);
  const packagesDir = path.join(outputDir, "packages");
  await fs.mkdir(packagesDir, { recursive: true });

  const releases = plan.flat().filter((release) => release.kind === "publish");

  const queue = createPromiseQueue(getDefaultWorkspaceConcurrency());
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );
  const publishTool = await getPublishTool(packages);

  const packedReleases = await Promise.all(
    releases.map((release) =>
      queue.add(async (): Promise<PackedRelease> => {
        const pkg = packagesByName.get(release.name);

        if (!pkg) {
          throw new Error(`Package not found: ${release.name}`);
        }

        const publishDirOverride = pkg.packageJson.publishConfig?.directory;
        if (publishDirOverride && publishTool.name === "yarn") {
          // Yarn doesn't allow publishing non-workspace directories
          log.error(
            `Package ${c.blue(pkg.packageJson.name)} has publishConfig.directory set to ${c.blue(publishDirOverride)}, which is not supported when using Yarn. Please remove publishConfig.directory from your package.json.`,
          );
          throw new ExitError(1);
        }
        const packDir = publishDirOverride
          ? path.resolve(pkg.dir, publishDirOverride)
          : pkg.dir;
        const tarballFilename = getNormalizedTarballFilename(
          release.name,
          release.version,
        );
        const tarballPath = path.join(packagesDir, tarballFilename);
        const packResult = await publishTool.pack({
          pkg,
          packDir,
          outputDir: packagesDir,
          tarballPath,
        });

        if ("error" in packResult) {
          const code = packResult.error.code
            ? `: ${packResult.error.code}`
            : "";
          log.error(
            `An error occurred while packing ${release.name}${code}\n${packResult.error.message || "Unknown error"}`,
          );
          throw new ExitError(1);
        }

        const resolvedTarballFilename = path.basename(packResult.tarballPath);
        const integrity = await getIntegrity(packResult.tarballPath);

        return {
          name: release.name,
          version: release.version,
          tarball: {
            path: path.posix.join("packages", resolvedTarballFilename),
            integrity,
          },
        };
      }),
    ),
  );

  const tarballFilenamesByRelease = new Map(
    packedReleases.map((release) => [
      `${release.name}@${release.version}`,
      release,
    ]),
  );
  const packedPlan = plan.map((group) =>
    group.map((release) => {
      if (release.kind !== "publish") {
        return release;
      }

      const packedRelease = tarballFilenamesByRelease.get(
        `${release.name}@${release.version}`,
      )!;

      return {
        ...release,
        tarball: packedRelease.tarball,
      };
    }),
  );

  await fs.writeFile(
    path.join(outputDir, "publish-plan.json"),
    JSON.stringify(
      {
        version: CURRENT_PUBLISH_PLAN_VERSION,
        plan: packedPlan,
      },
      undefined,
      2,
    ),
  );

  if (releases.length === 0) {
    log.info("No packages to pack.");
    return;
  }

  log.info(
    `
Packed packages:
${packedReleases.map((release) => `- ${release.name}@${release.version}`).join("\n")}
    `.trim(),
  );
}
