import semver from "semver";
import chalk from "chalk";
import { AccessType } from "@changesets/types";
import { Package } from "@manypkg/get-packages";
import * as npmUtils from "./npm-utils";
import { info, warn } from "@changesets/logger";
import { TwoFactorState } from "../../utils/types";
import { PreState } from "@changesets/types";
import isCI from "../../utils/isCI";
import { join } from "path";

function getReleaseTag(pkgInfo: PkgInfo, preState?: PreState, tag?: string) {
  if (tag) return tag;

  if (preState !== undefined && pkgInfo.publishedState !== "only-pre") {
    return preState.tag;
  }

  return "latest";
}

export default async function publishPackages({
  packages,
  access,
  otp,
  preState,
  tag
}: {
  packages: Package[];
  access: AccessType;
  otp?: string;
  preState: PreState | undefined;
  tag?: string;
}) {
  const packagesByName = new Map(packages.map(x => [x.packageJson.name, x]));
  const publicPackages = packages.filter(pkg => !pkg.packageJson.private);
  let twoFactorState: TwoFactorState =
    otp === undefined
      ? {
          token: null,
          isRequired:
            isCI ||
            publicPackages.some(
              x =>
                x.packageJson.publishConfig &&
                (x.packageJson.publishConfig as any).registry &&
                (x.packageJson.publishConfig as any).registry !==
                  "https://registry.npmjs.org" &&
                (x.packageJson.publishConfig as any).registry !==
                  "https://registry.yarnpkg.com"
            ) ||
            (process.env.npm_config_registry !== undefined &&
              process.env.npm_config_registry !==
                "https://registry.npmjs.org" &&
              process.env.npm_config_registry !==
                "https://registry.yarnpkg.com")
              ? Promise.resolve(false)
              : // note: we're not awaiting this here, we want this request to happen in parallel with getUnpublishedPackages
                npmUtils.getTokenIsRequired()
        }
      : {
          token: otp,
          isRequired: Promise.resolve(true)
        };
  const unpublishedPackagesInfo = await getUnpublishedPackages(
    publicPackages,
    preState
  );

  if (unpublishedPackagesInfo.length === 0) {
    warn("No unpublished packages to publish");
  }

  let promises: Promise<{
    name: string;
    newVersion: string;
    published: boolean;
  }>[] = [];

  for (let pkgInfo of unpublishedPackagesInfo) {
    let pkg = packagesByName.get(pkgInfo.name)!;
    promises.push(
      publishAPackage(
        pkg,
        access,
        twoFactorState,
        getReleaseTag(pkgInfo, preState, tag)
      )
    );
  }

  return Promise.all(promises);
}

async function publishAPackage(
  pkg: Package,
  access: AccessType,
  twoFactorState: TwoFactorState,
  tag: string
) {
  const { name, version, publishConfig } = pkg.packageJson;
  const localAccess = publishConfig && publishConfig.access;
  info(
    `Publishing ${chalk.cyan(`"${name}"`)} at ${chalk.green(`"${version}"`)}`
  );

  const publishDir =
    publishConfig && publishConfig.directory
      ? join(pkg.dir, publishConfig.directory)
      : pkg.dir;

  const publishConfirmation = await npmUtils.publish(
    name,
    {
      cwd: publishDir,
      access: localAccess || access,
      tag
    },
    twoFactorState
  );

  return {
    name,
    newVersion: version,
    published: publishConfirmation.published
  };
}

type PublishedState = "never" | "published" | "only-pre";

type PkgInfo = {
  name: string;
  localVersion: string;
  publishedState: PublishedState;
  publishedVersions: string[];
};

async function getUnpublishedPackages(
  packages: Array<Package>,
  preState: PreState | undefined
) {
  const results: Array<PkgInfo> = await Promise.all(
    packages.map(async pkg => {
      const config = pkg.packageJson;
      const response = await npmUtils.infoAllow404(config.name);
      let publishedState: PublishedState = "never";
      if (response.published) {
        publishedState = "published";
        if (preState !== undefined) {
          if (
            response.pkgInfo.versions &&
            response.pkgInfo.versions.every(
              (version: string) =>
                semver.parse(version)!.prerelease[0] === preState.tag
            )
          ) {
            publishedState = "only-pre";
          }
        }
      }

      return {
        name: config.name,
        localVersion: config.version,
        publishedState: publishedState,
        publishedVersions: response.pkgInfo.versions || []
      };
    })
  );

  const packagesToPublish: Array<PkgInfo> = [];

  for (const pkgInfo of results) {
    const { name, publishedState, localVersion, publishedVersions } = pkgInfo;
    if (!publishedVersions.includes(localVersion)) {
      packagesToPublish.push(pkgInfo);
      info(
        `${name} is being published because our local version (${localVersion}) has not been published on npm`
      );
      if (preState !== undefined && publishedState === "only-pre") {
        info(
          `${name} is being published to ${chalk.cyan(
            "latest"
          )} rather than ${chalk.cyan(
            preState.tag
          )} because there has not been a regular release of it yet`
        );
      }
    } else {
      // If the local version is behind npm, something is wrong, we warn here, and by not getting published later, it will fail
      warn(
        `${name} is not being published because version ${localVersion} is already published on npm`
      );
    }
  }

  return packagesToPublish;
}
