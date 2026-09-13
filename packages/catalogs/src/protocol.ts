import type { CatalogEntries, Catalogs } from "@changesets/types";
import { DEFAULT_CATALOG_NAME } from "./constants.ts";

const CATALOG_PROTOCOL = "catalog:";

export function parseCatalogProtocol(range: string): string | undefined {
  if (!range.startsWith(CATALOG_PROTOCOL)) {
    return undefined;
  }

  return range.slice(CATALOG_PROTOCOL.length).trim() || DEFAULT_CATALOG_NAME;
}

export function resolveCatalogRange(
  range: string,
  dependencyName: string,
  catalogs: Catalogs | undefined,
): string | undefined {
  const catalogName = parseCatalogProtocol(range);

  if (catalogName == null) {
    return range;
  }

  return catalogs?.entries.get(catalogName)?.get(dependencyName);
}

export interface ChangedCatalogEntry {
  catalogName: string;
  dependencyName: string;
}

export function getChangedCatalogEntries(
  before: CatalogEntries,
  after: CatalogEntries,
): ChangedCatalogEntry[] {
  const changed: ChangedCatalogEntry[] = [];

  for (const catalogName of new Set([...before.keys(), ...after.keys()])) {
    const beforeCatalog = before.get(catalogName);
    const afterCatalog = after.get(catalogName);

    const dependencyNames = new Set([
      ...(beforeCatalog?.keys() ?? []),
      ...(afterCatalog?.keys() ?? []),
    ]);

    for (const dependencyName of dependencyNames) {
      if (
        beforeCatalog?.get(dependencyName) !== afterCatalog?.get(dependencyName)
      ) {
        changed.push({ catalogName, dependencyName });
      }
    }
  }

  return changed;
}
