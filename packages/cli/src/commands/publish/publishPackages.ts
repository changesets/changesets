import { resolve } from "node:path";
import c from "@changesets/color";
import type { AccessType, Packages } from "@changesets/types";
import { log, progress } from "@clack/prompts";
import type { TwoFactorState } from "../../utils/types.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";
import {
  getPublishTool,
  getTokenIsRequired,
  isCustomRegistry,
  npmPublishQueue,
  publish,
} from "./npm-utils.ts";

export type PublishedResult = {
  name: string;
  version: string;
  result: "published" | "skipped" | "failed";
};

const getTwoFactorState = async ({
  otp,
  releases,
}: {
  otp?: string;
  releases: Array<PublishReleaseEntry>;
}): Promise<TwoFactorState> => {
  if (otp) {
    return {
      token: otp,
      isRequired: true,
    };
  }

  if (
    !process.stdin.isTTY ||
    releases.some((release) => isCustomRegistry(release.registry)) ||
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

export async function publishPackages({
  releases,
  packages,
  access,
  artifactDir,
  otp,
}: {
  releases: Array<PublishReleaseEntry>;
  packages: Packages;
  access: AccessType;
  artifactDir?: string;
  otp?: string;
}): Promise<PublishedResult[]> {
  if (releases.length === 0) {
    return [];
  }

  const packagesByName = new Map(
    packages.packages.map((pkg) => [pkg.packageJson.name, pkg]),
  );
  const twoFactorState = await getTwoFactorState({ otp, releases });
  const hasToDelegate = requiresDelegatedAuth(twoFactorState);
  if (hasToDelegate) {
    npmPublishQueue.setConcurrency(1);
  }

  const publishPromises = releases.map((release) =>
    publishAPackage(
      release,
      packagesByName.get(release.name)!,
      packages,
      access,
      artifactDir,
      twoFactorState,
    ),
  );

  if (!hasToDelegate && releases.length > 1) {
    const p = progress({ max: releases.length });
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
        if (result.result === "published") {
          log.success(
            `Published ${c.blue(result.name)}@${c.green(result.version)}!`,
          );
        }
        return result;
      }),
    );
  }
}

async function publishAPackage(
  release: PublishReleaseEntry,
  pkg: Packages["packages"][number],
  packages: Packages,
  access: AccessType,
  artifactDir: string | undefined,
  twoFactorState: TwoFactorState,
): Promise<PublishedResult> {
  const { name, version, publishConfig } = pkg.packageJson;
  const publishTool = await getPublishTool(packages.rootDir);
  const target = artifactDir
    ? resolve(artifactDir, release.tarball!.path)
    : publishTool.name === "pnpm"
      ? pkg.dir
      : publishConfig?.directory
        ? resolve(pkg.dir, publishConfig.directory)
        : pkg.dir;

  const publishConfirmation = await publish(
    pkg.packageJson,
    {
      cwd: packages.rootDir,
      target,
      access: publishConfig?.access || access,
      tag: release.tag,
    },
    twoFactorState,
  );

  return {
    name,
    version,
    result: publishConfirmation.result,
  };
}
