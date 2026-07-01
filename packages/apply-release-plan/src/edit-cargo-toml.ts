import { parseTOML, type AST } from "toml-eslint-parser";

/**
 * Updates the `version` field in the `[package]` section of a Cargo.toml,
 * preserving all other content and formatting. Workspace-inherited versions
 * (`version.workspace = true`) are not supported.
 */
export function editCargoTomlVersion(toml: string, newVersion: string): string {
  const topLevelTable = parseTOML(toml).body[0];

  const packageTable = topLevelTable.body.find(
    (node): node is AST.TOMLTable =>
      node.type === "TOMLTable" &&
      node.kind === "standard" &&
      node.resolvedKey.length === 1 &&
      node.resolvedKey[0] === "package",
  );
  if (!packageTable) {
    throw new Error("Could not find a `[package]` section in Cargo.toml");
  }

  const versionEntry = packageTable.body.find(
    (kv) => getKeyPath(kv) === "version",
  );
  if (!versionEntry) {
    const isWorkspaceInherited = packageTable.body.some((kv) =>
      getKeyPath(kv).startsWith("version."),
    );
    throw new Error(
      isWorkspaceInherited
        ? "Cannot update `version` in Cargo.toml: it is inherited via `version.workspace = true`, which is not supported"
        : "Could not find a `version` field in the `[package]` section of Cargo.toml",
    );
  }

  const { value } = versionEntry;
  if (value.type !== "TOMLValue" || value.kind !== "string") {
    throw new Error(
      "Expected the `version` field in the `[package]` section of Cargo.toml to be a string",
    );
  }

  const [start, end] = value.range;
  const quote = value.style === "literal" ? "'" : '"';
  return toml.slice(0, start) + quote + newVersion + quote + toml.slice(end);
}

function getKeyPath(keyValue: AST.TOMLKeyValue): string {
  return keyValue.key.keys
    .map((key) => (key.type === "TOMLBare" ? key.name : key.value))
    .join(".");
}
