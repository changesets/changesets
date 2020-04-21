import { Package, Packages } from "@manypkg/get-packages";
import * as npmUtils from "./npm-utils";
import { TwoFactorState } from "../../utils/types";
import isCI from "../../utils/isCI";

export default async function distTagPackages({
  otp,
  packages,
  tag
}: {
  otp?: string;
  packages: Packages;
  tag: string;
}) {
  let cleanTag = tag.toLowerCase().replace(/ /g, "-");

  let publicPackages = packages.packages.filter(
    pkg => !pkg.packageJson.private
  );

  let existingTags = await getExistingTags(publicPackages);

  if (existingTags.includes(cleanTag)) {
    // In the case where the global tag already exists, we want to not reapply it
    // so we can escape early
    return;
  }

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

  let promises: Promise<void>[] = [];

  for (let pkg of publicPackages) {
    promises.push(distTagApackage(pkg, twoFactorState, tag));
  }

  return Promise.all(promises);
}

async function getExistingTags(packages: Package[]): Promise<string[]> {
  for (let { packageJson } of packages) {
    let { pkgInfo } = await npmUtils.infoAllow404(packageJson.name);

    if (pkgInfo.version.length > 1) {
      return pkgInfo["dist-tags"];
    }
  }
  return [];
}

async function distTagApackage(
  pkg: Package,
  twoFactorState: TwoFactorState,
  tag: string
) {
  const { name, version } = pkg.packageJson;

  await npmUtils.distTag(name, version, tag, twoFactorState);
}
