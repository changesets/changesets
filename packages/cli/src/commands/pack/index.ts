import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString.ts";
import { readConfig } from "../../utils/read-config.ts";
import { getDefaultWorkspaceConcurrency } from "../../utils/workspaceConcurrency.ts";
import {
  CURRENT_PUBLISH_PLAN_VERSION,
  getPublishPlan,
  type PublishPlan,
  type TarballMetadata,
} from "../publish-plan/getPublishPlan.ts";
import { getPublishTool } from "../publish/npm-utils.ts";
import { ensureChangesetFolder } from "../shared.ts";

export interface PackOptions {
  cwd?: string;
  fromPlan?: string;
  outDir: string;
}

export interface PackedRelease {
  name: string;
  version: string;
  tarball: TarballMetadata;
}

function getTarballFilename(stdout: string) {
  const json = getLastJsonObjectFromString(stdout);
  // npm emits an array even when packing a single package
  // pnpm emits an object when packing a single package, and an array when packing multiple packages
  return Array.isArray(json) ? json[0]?.filename : json?.filename;
}

async function getIntegrity(filePath: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return `sha256-${hash.digest("base64")}`;
}

function readPlanFile(contents: string): PublishPlan {
  const json = JSON.parse(contents);

  if (!json || typeof json !== "object") {
    throw new Error("Invalid publish plan file");
  }

  if (!Array.isArray(json.plan)) {
    throw new Error("Invalid publish plan file");
  }

  if (json.version !== CURRENT_PUBLISH_PLAN_VERSION) {
    throw new Error(
      `Invalid publish plan file version: expected ${CURRENT_PUBLISH_PLAN_VERSION}, received ${String(json.version)}`,
    );
  }

  return json.plan as PublishPlan;
}

export async function pack(options: PackOptions) {
  const cwd = options.cwd ?? process.cwd();

  const packages = await getPackages(cwd);
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);

  const plan = options.fromPlan
    ? readPlanFile(
        await fs.readFile(path.resolve(cwd, options.fromPlan), "utf8"),
      )
    : await getPublishPlan(packages.rootDir, config);

  const outputDir = path.resolve(cwd, options.outDir);
  const packagesDir = path.join(outputDir, "packages");
  await fs.mkdir(packagesDir, { recursive: true });

  const releases = plan.flat().filter((release) => release.kind === "publish");

  const queue = createPromiseQueue(getDefaultWorkspaceConcurrency());
  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );

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
            ? ["pack", "--json", "--pack-destination", packagesDir]
            : ["pack", publishDir, "--json", "--pack-destination", packagesDir];
        const { exitCode, stdout, stderr } = await exec(
          publishTool.name,
          args,
          { nodeOptions: { cwd: pkg.dir } },
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
          throw new Error(
            `Failed to determine tarball filename for ${release.name}`,
          );
        }
        const integrity = await getIntegrity(
          path.join(packagesDir, tarballFilename),
        );

        return {
          name: release.name,
          version: release.version,
          tarball: {
            path: path.posix.join("packages", tarballFilename),
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
