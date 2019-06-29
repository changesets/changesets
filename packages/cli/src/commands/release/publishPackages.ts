import semver from "semver";
import chalk from "chalk";
import getWorkspaces from "../../utils/bolt-replacements/getWorkspaces";
import { Workspace } from "get-workspaces";
import * as boltNpm from "./npm-utils";
import logger from "../../utils/logger";

export default async function publishPackages({
  cwd,
  access
}: {
  cwd: string;
  access?: "public";
}) {
  const packages = await getWorkspaces({ cwd });
  const publicPackages = packages.filter(pkg => !pkg.config.private);

  const unpublishedPackagesInfo = await getUnpublishedPackages(publicPackages);
  const unpublishedPackages = publicPackages.filter(pkg => {
    return unpublishedPackagesInfo.some(p => pkg.name === p.name);
  });

  if (unpublishedPackagesInfo.length === 0) {
    logger.warn("No unpublished packages to publish");
  }

  const publishedPackages = await Promise.all(
    unpublishedPackages.map(pkg => publishAPackage(pkg, access))
  );

  return publishedPackages;
}

async function publishAPackage(pkg: Workspace, access?: "public") {
  const { name, version } = pkg.config;
  logger.info(
    `Publishing ${chalk.cyan(`"${name}"`)} at ${chalk.green(`"${version}"`)}`
  );

  const publishDir = pkg.dir;

  const publishConfirmation = await boltNpm.publish(name, {
    cwd: publishDir,
    access
  });

  return {
    name,
    newVersion: version,
    published: publishConfirmation.published
  };
}

type PkgInfo = {
  name: string;
  localVersion: string;
  isPublished: boolean;
  publishedVersion: string;
};

async function getUnpublishedPackages(packages: Array<Workspace>) {
  const results: Array<PkgInfo> = await Promise.all(
    packages.map(async pkg => {
      const config = pkg.config;
      const response = await boltNpm.infoAllow404(config.name);
      return {
        name: config.name,
        localVersion: config.version,
        isPublished: response.published,
        publishedVersion: response.pkgInfo.version || ""
      };
    })
  );

  const packagesToPublish: Array<PkgInfo> = [];

  for (const pkgInfo of results) {
    const { name, isPublished, localVersion, publishedVersion } = pkgInfo;
    if (!isPublished) {
      packagesToPublish.push(pkgInfo);
    } else if (semver.gt(localVersion, publishedVersion)) {
      packagesToPublish.push(pkgInfo);
      logger.info(
        `${name} is being published because our local version (${localVersion}) is ahead of npm's (${publishedVersion})`
      );
    } else if (semver.lt(localVersion, publishedVersion)) {
      // If the local version is behind npm, something is wrong, we warn here, and by not getting published later, it will fail
      logger.warn(
        `${name} is not being published because version ${publishedVersion} is already published on npm and we are trying to publish version ${localVersion}`
      );
    }
  }

  return packagesToPublish;
}
