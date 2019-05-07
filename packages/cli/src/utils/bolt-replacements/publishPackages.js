import semver from "semver";
import * as boltNpm from "bolt/dist/modern/utils/npm";
import * as boltMessages from "bolt/dist/modern/utils/messages";
import getWorkspaces from "./getWorkspaces";
import logger from "../logger";

export default async function publishPackages({ cwd, access }) {
  const packages = await getWorkspaces({ cwd });
  const publicPackages = packages.filter(pkg => !pkg.config.private);

  const unpublishedPackagesInfo = await getUnpublishedPackages(publicPackages);
  const unpublishedPackages = publicPackages.filter(pkg => {
    return unpublishedPackagesInfo.some(p => pkg.name === p.name);
  });

  if (unpublishedPackagesInfo.length === 0) {
    logger.warn(boltMessages.noUnpublishedPackagesToPublish());
  }

  const publishedPackages = await Promise.all(
    unpublishedPackages.map(pkg => publishAPackage(pkg, { cwd, access }))
  );

  return publishedPackages;
}

async function publishAPackage(pkg, opts) {
  const name = pkg.config.name;
  const version = pkg.config.version;
  logger.info(boltMessages.publishingPackage(name, version));

  const publishDir = pkg.dir;

  const publishConfirmation = await boltNpm.publish(name, {
    cwd: publishDir,
    access: opts.access
  });

  return {
    name,
    newVersion: version,
    published: publishConfirmation && publishConfirmation.published
  };
}

async function getUnpublishedPackages(packages) {
  const results = await Promise.all(
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

  const packagesToPublish = [];

  for (const pkgInfo of results) {
    const { name, isPublished, localVersion, publishedVersion } = pkgInfo;
    if (!isPublished) {
      packagesToPublish.push(pkgInfo);
    } else if (semver.gt(localVersion, publishedVersion)) {
      packagesToPublish.push(pkgInfo);
      logger.info(
        boltMessages.willPublishPackage(localVersion, publishedVersion, name)
      );
    } else if (semver.lt(localVersion, publishedVersion)) {
      // If the local version is behind npm, something is wrong, we warn here, and by not getting published later, it will fail
      logger.warn(
        boltMessages.willNotPublishPackage(localVersion, publishedVersion, name)
      );
    }
  }

  return packagesToPublish;
}
