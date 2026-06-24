import fs from "node:fs/promises";
import path from "node:path";
import type { RubyVersionProviderOptions } from "@changesets/types";
import type { VersionProvider, VersionedFile } from "./types.ts";

export const rubyVersionProvider: VersionProvider = {
  type: "ruby",
  async detect(context) {
    return hasRubyVersionFiles(
      context.pkg.dir,
      getRubyGemName(context.pkg.packageJson.name),
    );
  },
  async getCurrentVersion(context, options) {
    if (options.type !== "ruby") {
      throw new Error(`Expected ruby version provider options`);
    }

    const gemName =
      options.gemName ?? getRubyGemName(context.pkg.packageJson.name);
    const versionFile = await resolveRubyVersionFile(
      context.pkg.dir,
      gemName,
      options,
    );
    if (versionFile) {
      const version = readRubyVersionFile(
        await fs.readFile(versionFile, "utf8"),
      );
      if (version) return version;
    }

    const gemspec = await resolveRubyGemspec(context.pkg.dir, gemName, options);
    if (gemspec) {
      const version = readRubyGemspec(await fs.readFile(gemspec, "utf8"));
      if (version) return version;
    }

    const gemfileLock = await resolveOptionalFile(
      context.pkg.dir,
      options.gemfileLock,
      "Gemfile.lock",
    );
    if (gemfileLock) {
      const version = readRubyGemfileLock(
        await fs.readFile(gemfileLock, "utf8"),
        gemName,
      );
      if (version) return version;
    }

    return undefined;
  },
  async getVersionedFiles(context, options): Promise<VersionedFile[]> {
    if (options.type !== "ruby") {
      throw new Error(`Expected ruby version provider options`);
    }

    const files: VersionedFile[] = [];
    const rubyVersion = context.release.newVersion;
    const gemName = options.gemName ?? getRubyGemName(context.release.name);

    const versionFile = await resolveRubyVersionFile(
      context.release.dir,
      gemName,
      options,
    );
    if (versionFile) {
      files.push({
        path: versionFile,
        content: updateRubyVersionFile(
          await fs.readFile(versionFile, "utf8"),
          rubyVersion,
        ),
      });
    }

    const gemspec = await resolveRubyGemspec(
      context.release.dir,
      gemName,
      options,
    );
    if (gemspec) {
      files.push({
        path: gemspec,
        content: updateRubyGemspec(
          await fs.readFile(gemspec, "utf8"),
          rubyVersion,
        ),
      });
    }

    const gemfileLock = await resolveOptionalFile(
      context.release.dir,
      options.gemfileLock,
      "Gemfile.lock",
    );
    if (gemfileLock) {
      files.push({
        path: gemfileLock,
        content: updateRubyGemfileLock(
          await fs.readFile(gemfileLock, "utf8"),
          gemName,
          rubyVersion,
        ),
      });
    }

    return files;
  },
};

async function hasRubyVersionFiles(dir: string, gemName: string) {
  return (
    (await resolveRubyVersionFile(dir, gemName, { type: "ruby" })) != null ||
    (await resolveRubyGemspec(dir, gemName, { type: "ruby" })) != null ||
    (await fileExists(path.resolve(dir, "Gemfile.lock")))
  );
}

function getRubyGemName(packageName: string) {
  const withoutScope = packageName.startsWith("@")
    ? packageName.split("/").at(1)
    : packageName;
  return withoutScope ?? packageName;
}

async function resolveRubyVersionFile(
  dir: string,
  gemName: string,
  provider: RubyVersionProviderOptions,
) {
  if (provider.versionFile === false) return undefined;
  if (provider.versionFile) {
    return resolveRequiredFile(dir, provider.versionFile, "Ruby version file");
  }

  const candidates = [
    path.join("lib", gemName.replace(/-/g, "/"), "version.rb"),
    path.join("lib", gemName.replace(/-/g, "_"), "version.rb"),
  ];
  for (const candidate of candidates) {
    const filePath = path.resolve(dir, candidate);
    if (await fileExists(filePath)) return filePath;
  }

  const discovered = await findFiles(path.resolve(dir, "lib"), "version.rb");
  return discovered.length === 1 ? discovered[0] : undefined;
}

async function resolveRubyGemspec(
  dir: string,
  gemName: string,
  provider: RubyVersionProviderOptions,
) {
  if (provider.gemspec === false) return undefined;
  if (provider.gemspec) {
    return resolveRequiredFile(dir, provider.gemspec, "gemspec");
  }

  const candidates = [
    `${gemName}.gemspec`,
    `${gemName.replace(/-/g, "_")}.gemspec`,
  ];
  for (const candidate of candidates) {
    const filePath = path.resolve(dir, candidate);
    if (await fileExists(filePath)) return filePath;
  }

  const discovered = (await fs.readdir(dir)).filter((file) =>
    file.endsWith(".gemspec"),
  );
  return discovered.length === 1 ? path.resolve(dir, discovered[0]) : undefined;
}

async function resolveOptionalFile(
  dir: string,
  configuredPath: string | false | undefined,
  defaultPath: string,
) {
  if (configuredPath === false) return undefined;
  if (configuredPath)
    return resolveRequiredFile(dir, configuredPath, defaultPath);

  const filePath = path.resolve(dir, defaultPath);
  return (await fileExists(filePath)) ? filePath : undefined;
}

async function resolveRequiredFile(
  dir: string,
  relativePath: string,
  label: string,
) {
  const filePath = path.resolve(dir, relativePath);
  if (!(await fileExists(filePath))) {
    throw new Error(`${label} not found at ${relativePath}`);
  }
  return filePath;
}

async function fileExists(filePath: string) {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

async function findFiles(dir: string, basename: string): Promise<string[]> {
  if (!(await fileExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return findFiles(entryPath, basename);
      return entry.isFile() && entry.name === basename ? [entryPath] : [];
    }),
  );
  return files.flat();
}

function updateRubyVersionFile(content: string, version: string) {
  const nextContent = content.replace(
    /(\bVERSION\s*=\s*["'])([^"']+)(["'])/,
    `$1${version}$3`,
  );
  if (nextContent !== content) return nextContent;

  return content.replace(
    /(["'])(\d+\.\d+\.\d+(?:[-.][^"']+)?)(["'])/,
    `$1${version}$3`,
  );
}

function readRubyVersionFile(content: string) {
  return (
    content.match(/\bVERSION\s*=\s*["']([^"']+)["']/)?.[1] ??
    content.match(/["'](\d+\.\d+\.\d+(?:[-.][^"']+)?)["']/)?.[1]
  );
}

function updateRubyGemspec(content: string, version: string) {
  return content.replace(
    /(\.version\s*=\s*["'])([^"']+)(["'])/,
    `$1${version}$3`,
  );
}

function readRubyGemspec(content: string) {
  return content.match(/\.version\s*=\s*["']([^"']+)["']/)?.[1];
}

function updateRubyGemfileLock(
  content: string,
  gemName: string,
  version: string,
) {
  const escapedName = gemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lockVersion = version.replace(/-/g, ".pre.");
  return content.replace(
    new RegExp(`(^\\s*)${escapedName} \\([^\\n)]+\\)`, "m"),
    `$1${gemName} (${lockVersion})`,
  );
}

function readRubyGemfileLock(content: string, gemName: string) {
  const escapedName = gemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const version = content.match(
    new RegExp(`^\\s*${escapedName} \\(([^\\n)]+)\\)`, "m"),
  )?.[1];
  return version?.replace(".pre.", "-");
}
