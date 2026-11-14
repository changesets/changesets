import type { Package } from "@changesets/types";
import { describe, expect, it, vi } from "vitest";
import { resolveStageConflict } from "./common.ts";
import type { PackageInfoResult } from "./types.ts";

const options = {
  cwd: "/workspace",
  pkg: {
    dir: "/workspace/pkg-a",
    packageJson: { name: "pkg-a", version: "1.0.0" },
  } satisfies Package,
};
const duplicate = {
  name: "pkg-a",
  version: "1.0.0",
  result: "failed:already-done" as const,
  code: "E409",
};

describe("ambiguous stage conflicts", () => {
  it.each([
    { published: false },
    { published: true, info: { versions: ["0.0.0-stage.0"], "dist-tags": {} } },
  ] satisfies PackageInfoResult[])(
    "tolerates authoritative absence: %j",
    async (response) => {
      const lookup = vi.fn().mockResolvedValue(response);
      await expect(
        resolveStageConflict(duplicate, options, lookup),
      ).resolves.toEqual(duplicate);
      expect(lookup).toHaveBeenCalledExactlyOnceWith(options);
    },
  );

  it("rejects a published exact version even without a latest tag", async () => {
    await expect(
      resolveStageConflict(duplicate, options, async () => ({
        published: true,
        info: { versions: ["1.0.0"], "dist-tags": {} },
      })),
    ).resolves.toMatchObject({
      result: "failed",
      message: expect.stringContaining("Cannot stage already published"),
    });
  });

  it.each(["Unauthorized", "Network failure", "Invalid JSON"])(
    "fails closed on %s",
    async (message) => {
      await expect(
        resolveStageConflict(duplicate, options, async () => {
          throw new Error(message);
        }),
      ).resolves.toMatchObject({ result: "failed", message });
    },
  );

  it("preserves a lookup failure", async () => {
    await expect(
      resolveStageConflict(duplicate, options, async () => ({
        error: { code: "E401", message: "Unauthorized" },
      })),
    ).resolves.toEqual({
      name: "pkg-a",
      version: "1.0.0",
      result: "failed",
      code: "E401",
      message: "Unauthorized",
    });
  });
});
