import fs from "node:fs/promises";
import path from "node:path";
import type {
  CatalogEntries,
  CatalogFormat,
  Catalogs,
  CatalogSource,
} from "@changesets/types";
import { parse as parseYaml } from "yaml";
import { DEFAULT_CATALOG_NAME } from "./constants.ts";

const CATALOG_SOURCES: readonly CatalogSource[] = [
  { format: "pnpm-workspace", filePath: "pnpm-workspace.yaml" },
  { format: "pnpm-workspace", filePath: "pnpm-workspace.yml" },
  { format: "yarnrc", filePath: ".yarnrc.yml" },
  { format: "package-json", filePath: "package.json" },
];

export function parseCatalogs(
  contents: string,
  format: CatalogFormat,
): CatalogEntries {
  let parsed: unknown;

  try {
    parsed =
      format === "package-json" ? JSON.parse(contents) : parseYaml(contents);
  } catch {
    // A malformed manifest is the package manager's responsibility to report, not ours
    return new Map();
  }

  if (format !== "package-json") {
    return collectCatalogs(parsed);
  }

  // Bun allows catalogs both under `workspaces` and at the root, preferring `workspaces`
  const fromWorkspaces = collectCatalogs(
    isRecord(parsed) ? parsed.workspaces : undefined,
  );

  return fromWorkspaces.size > 0 ? fromWorkspaces : collectCatalogs(parsed);
}

export async function readCatalogs(rootDir: string): Promise<Catalogs> {
  for (const source of CATALOG_SOURCES) {
    const contents = await readFileIfExists(
      path.join(rootDir, source.filePath),
    );

    if (contents == null) {
      continue;
    }

    const entries = parseCatalogs(contents, source.format);

    if (entries.size > 0) {
      return { entries, source };
    }
  }

  return { entries: new Map(), source: undefined };
}

export async function withCatalogs<T extends { rootDir: string }>(
  packages: T,
): Promise<T & { catalogs: Catalogs }> {
  return { ...packages, catalogs: await readCatalogs(packages.rootDir) };
}

async function readFileIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function collectCatalogs(value: unknown): Map<string, Map<string, string>> {
  if (!isRecord(value)) {
    return new Map();
  }

  const declared: [string, unknown][] = [
    [DEFAULT_CATALOG_NAME, value.catalog],
    ...(isRecord(value.catalogs) ? Object.entries(value.catalogs) : []),
  ];

  const catalogs = new Map<string, Map<string, string>>();

  for (const [name, declaration] of declared) {
    const ranges = toRanges(declaration);

    if (ranges.size === 0) {
      continue;
    }

    // `catalog` and `catalogs.default` describe the same catalog, and `catalog` wins
    catalogs.set(name, new Map([...ranges, ...(catalogs.get(name) ?? [])]));
  }

  return catalogs;
}

function toRanges(value: unknown): Map<string, string> {
  if (!isRecord(value)) {
    return new Map();
  }

  return new Map(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
