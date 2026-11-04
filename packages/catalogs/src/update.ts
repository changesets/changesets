import type { CatalogEntryUpdate, CatalogFormat } from "@changesets/types";
import {
  applyEdits,
  findNodeAtLocation,
  parseTree,
  type Node,
} from "jsonc-parser";
import { isScalar, parseDocument } from "yaml";
import { DEFAULT_CATALOG_NAME } from "./constants.ts";

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export function updateCatalogEntries(
  contents: string,
  format: CatalogFormat,
  updates: readonly CatalogEntryUpdate[],
): string {
  if (updates.length === 0) {
    return contents;
  }

  return format === "package-json"
    ? updateJsonCatalogEntries(contents, updates)
    : updateYamlCatalogEntries(contents, format, updates);
}

function getEntryPaths(
  format: CatalogFormat,
  { catalogName, dependencyName }: CatalogEntryUpdate,
): string[][] {
  const paths =
    catalogName === DEFAULT_CATALOG_NAME
      ? [
          ["catalog", dependencyName],
          ["catalogs", DEFAULT_CATALOG_NAME, dependencyName],
        ]
      : [["catalogs", catalogName, dependencyName]];

  // Bun allows catalogs both under `workspaces` and at the root of `package.json`
  return format === "package-json"
    ? [...paths.map((entryPath) => ["workspaces", ...entryPath]), ...paths]
    : paths;
}

function updateYamlCatalogEntries(
  contents: string,
  format: CatalogFormat,
  updates: readonly CatalogEntryUpdate[],
): string {
  const doc = parseDocument(contents);
  const edits: TextEdit[] = [];

  for (const update of updates) {
    for (const entryPath of getEntryPaths(format, update)) {
      const node: unknown = doc.getIn(entryPath, true);

      if (!isScalar(node) || node.range == null) {
        continue;
      }

      const [start, end] = node.range;
      edits.push({
        start,
        end,
        text: formatYamlScalar(update.value, contents.slice(start, end)),
      });

      break;
    }
  }

  let updated = contents;

  for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
    updated =
      updated.slice(0, edit.start) + edit.text + updated.slice(edit.end);
  }

  return updated;
}

function updateJsonCatalogEntries(
  contents: string,
  updates: readonly CatalogEntryUpdate[],
): string {
  const root = parseTree(contents);

  if (!root) {
    return contents;
  }

  const edits = [];

  for (const update of updates) {
    let node: Node | undefined;

    for (const entryPath of getEntryPaths("package-json", update)) {
      node = findNodeAtLocation(root, entryPath);

      if (node) {
        break;
      }
    }

    if (!node) {
      continue;
    }

    edits.push({
      offset: node.offset,
      length: node.length,
      content: JSON.stringify(update.value),
    });
  }

  return applyEdits(contents, edits);
}

// Characters that give a plain YAML scalar a meaning other than "this text"
const YAML_INDICATOR_START = /^[-?:,[\]{}#&*!|>'"%@`]/;

function formatYamlScalar(value: string, originalSource: string): string {
  switch (originalSource[0]) {
    case "'":
      return `'${value.replaceAll("'", "''")}'`;
    case '"':
      return JSON.stringify(value);
    default:
      return YAML_INDICATOR_START.test(value) || /:\s|\s#/.test(value)
        ? JSON.stringify(value)
        : value;
  }
}
