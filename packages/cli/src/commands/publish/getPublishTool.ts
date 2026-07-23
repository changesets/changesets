import type { Packages } from "@changesets/types";
import { detect } from "package-manager-detector/detect";
import { exec } from "tinyexec";
import * as npm from "../../lib/npm.ts";
import * as pnpm from "../../lib/pnpm.ts";
import type { PublishTool } from "../../lib/types.ts";
import * as yarn from "../../lib/yarn.ts";

async function getYarnVersion(packages: Packages) {
  const { stdout } = await exec("yarn", ["--version"], {
    nodePath: false,
    nodeOptions: {
      cwd: packages.rootDir,
    },
  });
  const major = Number(stdout.toString().trim().split(".")[0]);
  return Number.isNaN(major) || major >= 2 ? "berry" : "classic";
}

export async function getPublishTool(packages: Packages): Promise<PublishTool> {
  let packageManager = packages.tool.type;

  if (!["npm", "pnpm", "yarn"].includes(packageManager)) {
    packageManager = (await detect({ cwd: packages.rootDir }))?.name ?? "npm";
  }

  if (packageManager === "pnpm") {
    return pnpm;
  }
  if (packageManager === "yarn") {
    if ((await getYarnVersion(packages)) === "classic") {
      throw new Error(
        "Yarn Classic is not supported. Please upgrade to Yarn Berry or another maintained package manager.",
      );
    }
    return yarn;
  }
  return npm;
}
