import semver, { SemVer } from "semver";
import chalk from "chalk";
import getWorkspaces from "../../utils/getWorkspaces";
import { Workspace } from "get-workspaces";
import * as npmUtils from "./npm-utils";
import { info, warn } from "@changesets/logger";
import { TwoFactorState } from "../../utils/types";
import { PreState } from "@changesets/types";

export default async function publishPackages({
  cwd,
  access,
  otp,
  preState
}: {
  cwd: string;
  access: "public" | "private";
  otp?: string;
  preState: PreState | undefined;
}) {
  const packages = await getWorkspaces({ cwd });
  const workspacesByName = new Map(packages.map(x => [x.name, x]));
  const publicPackages = packages.filter(pkg => !pkg.config.private);
  let twoFactorState: TwoFactorState =
    otp === undefined
      ? {
          token: null,
          // note: we're not awaiting this here, we want this request to happen in parallel with getUnpublishedPackages
          isRequired: npmUtils.getTokenIsRequired()
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
    let pkg = workspacesByName.get(pkgInfo.name)!;
    promises.push(
      publishAPackage(
        pkg,
        access,
        twoFactorState,
        preState === undefined
          ? "latest"
          : pkgInfo.publishedState === "only-pre"
          ? "latest"
          : preState.tag
      )
    );
  }

  return Promise.all(promises);
}

async function publishAPackage(
  pkg: Workspace,
  access: "public" | "private",
  twoFactorState: TwoFactorState,
  tag: string
) {
  const { name, version } = pkg.config;
  info(
    `Publishing ${chalk.cyan(`"${name}"`)} at ${chalk.green(`"${version}"`)}`
  );

  const publishDir = pkg.dir;

  const publishConfirmation = await npmUtils.publish(
    name,
    {
      cwd: publishDir,
      access,
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
  publishedVersion: string;
};

async function getUnpublishedPackages(
  packages: Array<Workspace>,
  preState: PreState | undefined
) {
  const results: Array<PkgInfo> = await Promise.all(
    packages.map(async pkg => {
      const config = pkg.config;
      const response = await npmUtils.infoAllow404(config.name);
      let publishedState: PublishedState = "never";
      if (response.published) {
        publishedState = "published";
        if (preState !== undefined) {
          if (
            response.pkgInfo.versions &&
            response.pkgInfo.versions.every(
              (version: string) =>
                new SemVer(version).prerelease[0] === preState.tag
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
        publishedVersion: response.pkgInfo.version || ""
      };
    })
  );

  const packagesToPublish: Array<PkgInfo> = [];

  for (const pkgInfo of results) {
    const { name, publishedState, localVersion, publishedVersion } = pkgInfo;
    if (publishedState === "never") {
      packagesToPublish.push(pkgInfo);
    } else if (semver.gt(localVersion, publishedVersion)) {
      packagesToPublish.push(pkgInfo);
      info(
        `${name} is being published because our local version (${localVersion}) is ahead of npm's (${publishedVersion})`
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
    } else if (semver.lt(localVersion, publishedVersion)) {
      // If the local version is behind npm, something is wrong, we warn here, and by not getting published later, it will fail
      warn(
        `${name} is not being published because version ${publishedVersion} is already published on npm and we are trying to publish version ${localVersion}`
      );
    }
  }

  return packagesToPublish;
}
