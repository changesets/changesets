import { resolve } from "node:path";
import type { Package } from "@changesets/types";
import type { PublishResult, PublishTool } from "../../lib/types.ts";
import type { PublishReleaseEntry } from "../publish-plan/getPublishPlan.ts";

export async function bulkPublishPackages({
  publishTool,
  releases,
  packagesByName,
  artifactDir,
  otp,
  onResult,
}: {
  publishTool: PublishTool;
  releases: Array<PublishReleaseEntry>;
  packagesByName: Map<string, Package>;
  artifactDir?: string;
  otp?: string;
  onResult?: () => void;
}): Promise<PublishResult[]> {
  if (releases.length === 0) return [];

  const otpCode = publishTool.getOtpCode(otp);

  const publishPromises = releases.map(async (release) => {
    const result = publishTool.publish({
      pkg: packagesByName.get(release.name)!,
      release,
      tarballPath: artifactDir
        ? resolve(artifactDir, release.tarball!.path)
        : null,
      interactive: false,
      otpCode,
    });

    onResult?.();
    return result;
  });

  return Promise.all(publishPromises);
}
