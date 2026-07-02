import type { Config } from "@changesets/types";
import { getVersionProvider } from "./version-providers/index.ts";
import type {
  ModCompWithPackageAndChangelog,
  VersionProviderContext,
  VersionedFile,
  VersionToUpdate,
} from "./version-providers/types.ts";

export type { ModCompWithPackageAndChangelog } from "./version-providers/types.ts";

type ModCompWithPackageAndChangelogAndEdits = ModCompWithPackageAndChangelog & {
  versionedFiles: VersionedFile[];
};

type VersionPackageOptions = Omit<
  VersionProviderContext,
  "pkg" | "release" | "versionsToUpdate"
> & {
  versionProvider: Config["versionProvider"];
};

export async function versionPackage(
  release: ModCompWithPackageAndChangelog,
  versionsToUpdate: VersionToUpdate[],
  options: VersionPackageOptions,
): Promise<ModCompWithPackageAndChangelogAndEdits> {
  const context: VersionProviderContext = {
    pkg: {
      dir: release.dir,
      packageJson: release.packageJson,
    },
    release,
    versionsToUpdate,
    cwd: options.cwd,
    updateInternalDependencies: options.updateInternalDependencies,
    onlyUpdatePeerDependentsWhenOutOfRange:
      options.onlyUpdatePeerDependentsWhenOutOfRange,
    bumpVersionsWithWorkspaceProtocolOnly:
      options.bumpVersionsWithWorkspaceProtocolOnly,
    snapshot: options.snapshot,
  };
  const { provider, options: providerOptions } = await getVersionProvider(
    context,
    options.versionProvider,
  );

  return {
    ...release,
    versionedFiles: await provider.getVersionedFiles(context, providerOptions),
  };
}
