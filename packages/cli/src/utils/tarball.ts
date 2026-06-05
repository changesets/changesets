import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import tar from "tar-stream";

const FILE_MODE = 0o644;
const STABLE_MTIME = new Date("1985-10-26T08:15:00.000Z");

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
  files: Array<string> = [],
): Promise<Array<string>> {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectFilesRecursively(entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function packTarball(dir: string, target: string) {
  const pack = tar.pack();
  const tarball = createWriteStream(target);
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

export async function extractTarball(tarballPath: string, targetDir: string) {
  await fs.mkdir(targetDir, { recursive: true });
  const resolvedTargetDir = path.resolve(targetDir);
  const extract = tar.extract();

  extract.on("entry", (header, stream, next) => {
    const filePath = path.join(resolvedTargetDir, header.name);
    const resolvedFilePath = path.resolve(filePath);

    if (!resolvedFilePath.startsWith(`${resolvedTargetDir}${path.sep}`)) {
      next(new Error(`Tar entry escapes target directory: ${header.name}`));
      return;
    }

    fs.mkdir(path.dirname(filePath), { recursive: true })
      .then(() => pipeline(stream, createWriteStream(filePath)))
      .then(() => next(), next);
  });

  await pipeline(createReadStream(tarballPath), createGunzip(), extract);
}
