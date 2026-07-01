const PACKAGE_HEADER_RE = /^\[package\][ \t]*(\r?\n|$)/m;
const NEXT_HEADER_RE = /^\[/m;
const VERSION_FIELD_RE = /^([ \t]*version[ \t]*=[ \t]*)(["'])(.*?)\2/m;

/**
 * Updates the `version` field in the `[package]` section of a Cargo.toml,
 * preserving all other content and formatting. Workspace-inherited versions
 * (`version.workspace = true`) are not supported.
 */
export function editCargoTomlVersion(toml: string, newVersion: string): string {
  const packageHeaderMatch = PACKAGE_HEADER_RE.exec(toml);
  if (!packageHeaderMatch) {
    throw new Error("Could not find a `[package]` section in Cargo.toml");
  }
  const sectionStart = packageHeaderMatch.index + packageHeaderMatch[0].length;

  const nextHeaderMatch = NEXT_HEADER_RE.exec(toml.slice(sectionStart));
  const sectionEnd = nextHeaderMatch
    ? sectionStart + nextHeaderMatch.index
    : toml.length;
  const section = toml.slice(sectionStart, sectionEnd);

  const versionMatch = VERSION_FIELD_RE.exec(section);
  if (!versionMatch) {
    throw new Error(
      "Could not find a `version` field in the `[package]` section of Cargo.toml (workspace-inherited versions via `version.workspace = true` are not supported)",
    );
  }

  const valueStart =
    sectionStart + versionMatch.index + versionMatch[1].length + 1;
  const valueEnd = valueStart + versionMatch[3].length;

  return toml.slice(0, valueStart) + newVersion + toml.slice(valueEnd);
}
