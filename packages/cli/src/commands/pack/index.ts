import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString.ts";
import { readConfig } from "../../utils/read-config.ts";
import { packTarball } from "../../utils/tarball.ts";
import {
  getPublishPlan,
  type PublishPlan,
  type TarballMetadata,
} from "../publish-plan/getPublishPlan.ts";
import { getPublishTool } from "../publish/npm-utils.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { getDefaultWorkspaceConcurrency } from "../../utils/workspaceConcurrency.ts";

export interface PackOptions {
  cwd?: string;
  from?: string;
}

export interface PackedRelease {
  name: string;
  version: string;
  tarball: TarballMetadata;
}

export interface PackResult {
  tarballPath: string | undefined;
}

function getTarballFilename(stdout: string) {
  const json = getLastJsonObjectFromString(stdout);
  return Array.isArray(json) ? json[0]?.filename : json?.filename;
}

async function getChecksum(filePath: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function pack(
  options?: PackOptions,
): Promise<PackResult> {
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
    return {
      tarballPath: undefined,
    };
  }

  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "changesets-pack-"));
  const packagesDir = path.join(outputDir, "packages");
  await fs.mkdir(packagesDir, { recursive: true });

  const queue = createPromiseQueue(getDefaultWorkspaceConcurrency());
  const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));

  const packedReleases = await Promise.all(
    releases.map((release) =>
      queue.add(async (): Promise<PackedRelease> => {
        const pkg = packagesByName.get(release.name);

        if (!pkg) {
          throw new Error(`Package not found: ${release.name}`);
        }

        const publishTool = await getPublishTool(packages.tool);
        const publishDir = pkg.packageJson.publishConfig?.directory
          ? path.resolve(pkg.dir, pkg.packageJson.publishConfig.directory)
          : pkg.dir;
        const args =
          publishTool.name === "pnpm"
            ? ["pack", "--json", "--pack-destination", packagesDir]
            : ["pack", publishDir, "--json", "--pack-destination", packagesDir];
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
        const checksum = await getChecksum(
          path.join(packagesDir, tarballFilename),
        );

        return {
          name: release.name,
          version: release.version,
          tarball: {
            filename: tarballFilename,
            checksum,
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
    JSON.stringify(packedPlan, undefined, 2),
  );
  const tarballPath = path.join(packages.rootDir, "changesets-pack.tgz");
  await packTarball(outputDir, tarballPath);

  log.info(
    `
Packed packages:
${packedReleases.map((release) => `- ${release.name}@${release.version}`).join("\n")}
    `.trim(),
  );
  log.info(`Pack artifact: ${tarballPath}`);

  return {
    tarballPath,
  };
}
