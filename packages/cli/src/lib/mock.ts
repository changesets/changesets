import path from "node:path";
import { createInterface } from "node:readline/promises";
import { npmPublishQueue } from "./common.ts";
import type { PublishOptions, PublishResult, PublishTool } from "./types.ts";

// -- PublishTool -- //

export const name = "mock" satisfies PublishTool["name"];

export function getOtpCode(otp?: string): string | null {
  return (
    otp || process.env.NPM_CONFIG_OTP || process.env.npm_config_otp || null
  );
}

let publishes = 0;
export const publish = async ({
  pkg,
  release,
  tarballPath,
  interactive,
  otpCode,
}: PublishOptions): Promise<PublishResult> =>
  npmPublishQueue.add(async () => {
    const cwd = pkg.dir;

    const args: string[] = [
      "--json",
      "--access",
      release.access,
      "--tag",
      release.tag,
    ];
    if (otpCode) args.push("--otp", otpCode);
    if (tarballPath) {
      args.unshift(path.relative(cwd, tarballPath));
    } else if (pkg.packageJson.publishConfig?.directory != null) {
      // support `publishConfig.directory`
      args.unshift(path.resolve(cwd, pkg.packageJson.publishConfig.directory));
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 500 + 500),
    );

    const resultBase = { name: release.name, version: release.version };
    publishes++;

    // when in interactive mode, return published:interactive on the first package
    if (publishes === 1) {
      return { ...resultBase, result: "failed:needs-2fa", summary: "asdasd" };
    }
    if (publishes === 2 && interactive) {
      const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      await readline.question("\nplease press enter to simulate 2fa:\n");
      readline.close();
      return { ...resultBase, result: "published:interactive" };
    }
    if (publishes === 3 && !interactive) {
      return { ...resultBase, result: "published" };
    }

    const random = Math.random();
    if (random < 0.5) {
      return { ...resultBase, result: "published" };
    } else {
      return {
        ...resultBase,
        result: "failed",
        summary: "Fake publish failure...",
      };
    }
  });
