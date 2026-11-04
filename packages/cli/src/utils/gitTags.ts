import * as git from "@changesets/git";
import type { Packages } from "@changesets/types";

type Release = {
  name: string;
  version: string;
};

export function buildGitTag(
  tool: Packages["tool"],
  { name, version }: Release,
  gitTagFormat: string | undefined,
) {
  if (gitTagFormat != null) {
    // a single pass with a replacer function, so that `$` patterns in the values
    // aren't interpreted and a value containing `{version}` isn't substituted again
    return gitTagFormat.replace(/\{(name|version)\}/g, (_, key: string) =>
      key === "name" ? name : version,
    );
  }
  return tool.type !== "root" ? `${name}@${version}` : `v${version}`;
}

export async function splitByTagStatus<T extends Release>(
  cwd: string,
  tool: Packages["tool"],
  releases: readonly T[],
  gitTagFormat: string | undefined,
): Promise<{ untagged: T[]; existing: T[] }> {
  if (releases.length === 0) {
    return { untagged: [], existing: [] };
  }

  const localTags = await git.getAllTags(cwd);
  const tagStatuses = await Promise.all(
    releases.map(async (release) => {
      const tagName = buildGitTag(tool, release, gitTagFormat);
      return localTags.has(tagName) || (await git.remoteTagExists(tagName));
    }),
  );

  const untagged: T[] = [];
  const existing: T[] = [];

  for (const [index, hasTag] of tagStatuses.entries()) {
    (hasTag ? existing : untagged).push(releases[index]);
  }

  return { untagged, existing };
}
