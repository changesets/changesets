import { resolve } from "node:path";
import c from "@changesets/color";
import type { AccessType } from "@changesets/types";
import { log, progress } from "@clack/prompts";
import type { TwoFactorState } from "../../utils/types.ts";
import {
  getCorrectRegistry,
  getTokenIsRequired,
  isCustomRegistry,
  npmPublishQueue,
  publish,
} from "./npm-utils.ts";
import type { PackageReleaseEntry } from "./getReleaseEntries.ts";

export type PublishedResult = {
  name: string;
  newVersion: string;
  result: "published" | "skipped" | "failed";
};

const getTwoFactorState = async ({
  otp,
  releases,
}: {
  otp?: string;
  releases: Array<PackageReleaseEntry>;
}): Promise<TwoFactorState> => {
  if (otp) {
    return {
      token: otp,
      isRequired: true,
    };
  }

  if (
    !process.stdin.isTTY ||
    releases.some((release) =>
      isCustomRegistry(getCorrectRegistry(release.pkg.packageJson).registry),
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

export async function publishPackages({
  releases,
  access,
  otp,
}: {
  releases: Array<PackageReleaseEntry>;
  access: AccessType;
  otp?: string;
}): Promise<PublishedResult[]> {
  if (releases.length === 0) {
    return [];
  }

  const twoFactorState = await getTwoFactorState({ otp, releases });
  const hasToDelegate = requiresDelegatedAuth(twoFactorState);
  if (hasToDelegate) {
    npmPublishQueue.setConcurrency(1);
  }

  const publishPromises = releases.map((release) =>
    publishAPackage(release, access, twoFactorState),
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
        log.success(
          `Published ${c.blue(result.name)}@${c.green(result.newVersion)}!`,
        );
        return result;
      }),
    );
  }
}

async function publishAPackage(
  release: PackageReleaseEntry,
  access: AccessType,
  twoFactorState: TwoFactorState,
): Promise<PublishedResult> {
  const pkg = release.pkg;
  const { name, version, publishConfig } = pkg.packageJson;

  const publishConfirmation = await publish(
    pkg.packageJson,
    {
      cwd: pkg.dir,
      publishDir: publishConfig?.directory
        ? resolve(pkg.dir, publishConfig.directory)
        : pkg.dir,
      access: publishConfig?.access || access,
      tag: release.tag,
    },
    twoFactorState,
  );

  return {
    name,
    newVersion: version,
    result: publishConfirmation.result,
  };
}
