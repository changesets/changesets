import type {
  Config,
  Packages,
  PackageVersionProvider,
} from "@changesets/types";
import { nodeVersionProvider } from "./node.ts";
import { rubyVersionProvider } from "./ruby.ts";
import type {
  ResolvedVersionProviderOptions,
  VersionProvider,
  VersionProviderContext,
  VersionProviderPackageContext,
} from "./types.ts";

const versionProviders: VersionProvider[] = [
  rubyVersionProvider,
  nodeVersionProvider,
];

export async function getVersionProvider(
  context: VersionProviderContext,
  config: Config["versionProvider"],
) {
  return getVersionProviderForPackage(context, config);
}

export async function updatePackageVersionsFromVersionProviders(
  packages: Packages,
  config: Config["versionProvider"],
) {
  await Promise.all(
    packages.packages.map(async (pkg) => {
      const context: VersionProviderPackageContext = {
        pkg,
        cwd: packages.rootDir,
      };
      const { provider, options } = await getVersionProviderForPackage(
        context,
        config,
      );
      const version = await provider.getCurrentVersion(context, options);
      if (version) {
        pkg.packageJson.version = version;
      }
    }),
  );
}

async function getVersionProviderForPackage(
  context: VersionProviderPackageContext,
  config: Config["versionProvider"],
) {
  const configuredProvider =
    config.packages[context.pkg.packageJson.name] ?? config.default ?? "auto";
  const providerOptions = normalizeProviderOptions(configuredProvider);

  if (providerOptions !== "auto") {
    return {
      provider: getProviderForType(providerOptions.type),
      options: providerOptions,
    };
  }

  for (const provider of versionProviders) {
    if (await provider.detect(context)) {
      return {
        provider,
        options: { type: provider.type } as ResolvedVersionProviderOptions,
      };
    }
  }

  throw new Error(
    `No version provider found for ${context.pkg.packageJson.name}`,
  );
}

function normalizeProviderOptions(
  provider: PackageVersionProvider,
): ResolvedVersionProviderOptions | "auto" {
  if (provider === "auto") return "auto";
  if (typeof provider === "string") return { type: provider };
  return provider;
}

function getProviderForType(type: ResolvedVersionProviderOptions["type"]) {
  const provider = versionProviders.find((provider) => provider.type === type);
  if (!provider) throw new Error(`Unknown version provider: ${type}`);
  return provider;
}
