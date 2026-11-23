import type { Packages } from "@changesets/types";
import { detect } from "package-manager-detector/detect";
import semverSatisfies from "semver/functions/satisfies.js";
import { exec } from "tinyexec";
import * as npm from "../../lib/npm.ts";
import * as pnpm from "../../lib/pnpm.ts";
import type { PublishTool } from "../../lib/types.ts";
import * as yarn from "../../lib/yarn.ts";

async function getPackageManagerVersion(cwd: string, packageManager: string) {
  const { stdout } = await exec(packageManager, ["--version"], {
    nodePath: false,
    nodeOptions: {
      cwd,
    },
  });
  return stdout.trim();
}

export async function getPublishTool(
  packages: Packages,
  stage = false,
): Promise<PublishTool> {
  let packageManager = packages.tool.type;

  if (!["npm", "pnpm", "yarn"].includes(packageManager)) {
    packageManager = (await detect({ cwd: packages.rootDir }))?.name ?? "npm";
  }

  if (!["pnpm", "yarn"].includes(packageManager)) {
    packageManager = "npm";
  }

  const version =
    stage || packageManager === "pnpm" || packageManager === "yarn"
      ? await getPackageManagerVersion(packages.rootDir, packageManager)
      : undefined;

  if (stage) {
    const minimum =
      packageManager === "pnpm"
        ? "11.3.0"
        : packageManager === "yarn"
          ? "4.16.0"
          : "11.15.0";
    if (!semverSatisfies(version!, `>=${minimum}`)) {
      throw new Error(
        `Staged publishing requires ${packageManager} >=${minimum}. Upgrade ${packageManager} or use --no-stage for ordinary publishing.`,
      );
    }
  }

  if (packageManager === "pnpm") {
    const major = Number(version!.split(".")[0]);
    return {
      name: pnpm.name,
      getOtpCode: pnpm.getOtpCode,
      info: (args) => pnpm.info(args, { major }),
      pack: (args) => pnpm.pack(args, { major }),
      publish: (args) => pnpm.publish(args, { major }),
    };
  }
  if (packageManager === "yarn") {
    const major = Number(version!.split(".")[0]);
    if (!Number.isNaN(major) && major < 2) {
      throw new Error(
        "Yarn Classic is not supported. Please upgrade to Yarn Berry or another maintained package manager.",
      );
    }
    return yarn;
  }
  return npm;
}
