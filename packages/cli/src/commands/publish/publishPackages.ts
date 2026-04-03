import { log, progress } from "@clack/prompts";
import type { AccessType, Package, PreState } from "@changesets/types";
import { resolve } from "path";
import pc from "picocolors";
import semverParse from "semver/functions/parse.js";
import type { TwoFactorState } from "../../utils/types.ts";
import {
  getCorrectRegistry,
  getTokenIsRequired,
  infoAllow404,
  isCustomRegistry,
  npmPublishQueue,
  publish,
} from "./npm-utils.ts";

type PublishedState = "never" | "published" | "only-pre";

type PkgInfo = {
  name: string;
  localVersion: string;
  publishedState: PublishedState;
  publishedVersions: string[];
};

export type PublishedResult = {
  name: string;
  newVersion: string;
  published: boolean;
};

function getReleaseTag(pkgInfo: PkgInfo, preState?: PreState, tag?: string) {
  if (tag) return tag;

  if (preState !== undefined && pkgInfo.publishedState !== "only-pre") {
    return preState.tag;
  }

  return "latest";
}

const getTwoFactorState = async ({
  otp,
  publicPackages,
}: {
  otp?: string;
  publicPackages: Package[];
}): Promise<TwoFactorState> => {
  if (otp) {
    return {
      token: otp,
      isRequired: true,
    };
  }

  if (
    !process.stdin.isTTY ||
    publicPackages.some((pkg) =>
      isCustomRegistry(getCorrectRegistry(pkg.packageJson).registry),
    ) ||
    isCustomRegistry(process.env.npm_config_registry)
  ) {
    return {
      token: undefined,
      isRequired: false,
    };
  }

  return {
    token: undefined,
    isRequired: await getTokenIsRequired(),
  };
};

export const requiresDelegatedAuth = (twoFactorState: TwoFactorState) => {
  return (
    process.stdin.isTTY &&
    !twoFactorState.token &&
    !twoFactorState.allowConcurrency &&
    twoFactorState.isRequired
  );
};

export default async function publishPackages({
  packages,
  access,
  otp,
  preState,
  tag,
}: {
  packages: Package[];
  access: AccessType;
  otp?: string;
  preState: PreState | undefined;
  tag?: string;
}): Promise<PublishedResult[]> {
  const packagesByName = new Map(packages.map((x) => [x.packageJson.name, x]));
  const publicPackages = packages.filter((pkg) => !pkg.packageJson.private);
  const unpublishedPackagesInfo = await getUnpublishedPackages(
    publicPackages,
    preState,
  );

  if (unpublishedPackagesInfo.length === 0) {
    return [];
  }

  const twoFactorState = await getTwoFactorState({ otp, publicPackages });
  const hasToDelegate = requiresDelegatedAuth(twoFactorState);
  if (hasToDelegate) {
    npmPublishQueue.setConcurrency(1);
  }

  const publishPromises = unpublishedPackagesInfo.map((pkgInfo) => {
    let pkg = packagesByName.get(pkgInfo.name)!;
    return publishAPackage(
      pkg,
      access,
      twoFactorState,
      getReleaseTag(pkgInfo, preState, tag),
    );
  });

  if (!hasToDelegate && unpublishedPackagesInfo.length > 1) {
    const p = progress({ max: unpublishedPackagesInfo.length });
    p.start("Publishing packages...");

    const results = await Promise.all(
      publishPromises.map(async (publishPromise) => {
        const result = await publishPromise;
        p.advance();
        return result;
      }),
    );

    p.stop(`Published ${publishPromises.length} packages!`);
    return results;
  } else {
    return Promise.all(
      publishPromises.map(async (publishPromise) => {
        const result = await publishPromise;
        log.success(
          `Published ${pc.blue(result.name)}@${pc.green(result.newVersion)}!`,
        );
        return result;
      }),
    );
  }
}

async function publishAPackage(
  pkg: Package,
  access: AccessType,
  twoFactorState: TwoFactorState,
  tag: string,
): Promise<PublishedResult> {
  const { name, version, publishConfig } = pkg.packageJson;

  const publishConfirmation = await publish(
    pkg.packageJson,
    {
      cwd: pkg.dir,
      publishDir: publishConfig?.directory
        ? resolve(pkg.dir, publishConfig.directory)
        : pkg.dir,
      access: publishConfig?.access || access,
      tag,
    },
    twoFactorState,
  );

  return {
    name,
    newVersion: version,
    published: publishConfirmation.published,
  };
}

async function getUnpublishedPackages(
  packages: Array<Package>,
  preState: PreState | undefined,
) {
  const results: Array<PkgInfo> = await Promise.all(
    packages.map(async ({ packageJson }) => {
      const response = await infoAllow404(packageJson);
      let publishedState: PublishedState = "never";
      if (response.published) {
        publishedState = "published";
        if (preState !== undefined) {
          if (
            response.pkgInfo.versions &&
            response.pkgInfo.versions.every(
              (version: string) =>
                semverParse(version)!.prerelease[0] === preState.tag,
            )
          ) {
            publishedState = "only-pre";
          }
        }
      }

      return {
        name: packageJson.name,
        localVersion: packageJson.version,
        publishedState,
        publishedVersions: response.pkgInfo.versions || [],
      };
    }),
  );

  const packagesToPublish: Array<PkgInfo> = [];
  const previewLines: string[] = [];
  let alreadyPublishedCount = 0;

  for (const pkgInfo of results) {
    const { name, publishedState, localVersion, publishedVersions } = pkgInfo;
    if (!publishedVersions.includes(localVersion)) {
      packagesToPublish.push(pkgInfo);
      previewLines.push(`${pc.blue(name)}@${pc.green(localVersion)}`);
      if (preState !== undefined && publishedState === "only-pre") {
        previewLines.push(
          `${pc.gray("└")} will be published to ${pc.cyan("latest")} rather than ${pc.cyan(preState.tag)} as it will be its first published version.`,
        );
      }
    } else {
      alreadyPublishedCount++;
    }
  }

  if (packagesToPublish.length !== 0) {
    log.info(
      `
These packages will be published as they were not found on npm:
${previewLines.join("\n")}
${pc.gray(`${alreadyPublishedCount} packages are already published.`)}
      `.trim(),
    );
  }

  return packagesToPublish;
}
