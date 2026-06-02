import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as getPublishPlanModule from "../../publish-plan/getPublishPlan.ts";
import { publish as runRelease } from "../index.ts";
import * as publishPackagesModule from "../publishPackages.ts";

vi.mock("@changesets/git");
vi.mock("../publishPackages.ts");
vi.mock("../../publish-plan/getPublishPlan.ts");

describe("running release", () => {
  silenceLogsInBlock();

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("When there is no changeset commits", () => {
    it("should still run publishPackages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
          dependencies: {
            "pkg-b": "1.0.0",
          },
        }),
        "packages/pkg-b/package.json": JSON.stringify({
          name: "pkg-b",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(defaultConfig),
      });

      vi.mocked(git.tag).mockResolvedValue(undefined as never);
      vi.mocked(publishPackagesModule.publishPackages).mockResolvedValue([
        { name: "pkg-a", version: "1.1.0", result: "published" },
        { name: "pkg-b", version: "1.0.1", result: "published" },
      ]);
      vi.mocked(getPublishPlanModule.getPublishPlan).mockResolvedValue([[]]);

      await runRelease({ cwd });

      expect(publishPackagesModule.publishPackages).toHaveBeenCalled();
    });
  });
});
