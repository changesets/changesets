import { createReadStream, createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import tar from "tar-stream";
import { exec } from "tinyexec";
import { createPromiseQueue } from "../../utils/createPromiseQueue.ts";
import { getLastJsonObjectFromString } from "../../utils/getLastJsonObjectFromString.ts";
import { readConfig } from "../../utils/read-config.ts";
import {
  getPublishPlan,
  type PublishPlan,
  type TarballMetadata,
} from "../publish-plan/getPublishPlan.ts";
import { getPublishTool } from "../publish/npm-utils.ts";
import { ensureChangesetFolder } from "../shared.ts";
import { getDefaultWorkspaceConcurrency } from "../../utils/workspaceConcurrency.ts";

const FILE_MODE = 0o644;
const STABLE_MTIME = new Date("1985-10-26T08:15:00.000Z");

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

async function addFileEntry(
  pack: tar.Pack,
  name: string,
  source: string,
) {
  const stat = await fs.stat(source);

  await new Promise<void>((resolve, reject) => {
    const entry = pack.entry(
      { name, mode: FILE_MODE, mtime: STABLE_MTIME, size: stat.size },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );

    pipeline(createReadStream(source), entry).catch(reject);
  });
}

async function collectFilesRecursively(
  dir: string,
  files: Array<string> = []
): Promise<Array<string>> {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort(
    (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFilesRecursively(entryPath, files)
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function createTarball(dir: string, target: string) {
  const pack = tar.pack();
  const tarball = createWriteStream(target);
  // for reproducible tarballs, we need to ensure that the entries are always in the same order
  // so we have to collect sorted files first
  const files = await collectFilesRecursively(dir);

  const tarballPromise = pipeline(pack, createGzip(), tarball);

  for (const file of files) {
    await addFileEntry(
      pack,
      path.relative(dir, file).split(path.sep).join(path.posix.sep),
      file,
    );
  }

  pack.finalize();
  await tarballPromise;
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

        const publishTool = await getPublishTool(pkg.dir);
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
  await createTarball(outputDir, tarballPath);

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
