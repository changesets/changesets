import { PackageJSON, ScopedPackageInfo } from "@changesets/types";
import isScoped from "is-scoped";
import { PublishedResult } from "../publish/publishPackages";

/**
 * Attempts to split the package name into organizationName/packageName and version number to get the
 */
export function parsePackage(
  packageJson: PackageJSON | PublishedResult
): ScopedPackageInfo {
  const { name } = packageJson;
  const isScopedPackage = isScoped(name);

  let version;
  if ("version" in packageJson) {
    version = packageJson.version;
  } else if ("newVersion" in packageJson) {
    version = packageJson.newVersion;
  }

  return {
    organizationName: isScopedPackage
      ? name.split("/")[0].slice(1) /** remove first @ */
      : undefined,
    packageName: name,
    projectName: isScopedPackage ? name.split("/")[1] : name,
    version: version!,
  };
}

/**
 * replace placeholders in a string with values from a package.json
 */
export function replacePlaceholders(
  parseResult: ScopedPackageInfo,
  str?: string
): string {
  let format = `{packageName}@{version}`;

  if (typeof str === "string" && str.length > 0) format = str;

  return Object.entries(parseResult).reduce((acc, [key, value]) => {
    if (!value) return acc;
    return acc.replace(new RegExp(`{${key}}`, "g"), value);
  }, format);
}
