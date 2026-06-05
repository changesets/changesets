import fs from "node:fs/promises";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as getPublishPlanModule from "../../publish-plan/getPublishPlan.ts";
import * as tarball from "../../../utils/tarball.ts";
import { publish as runRelease } from "../index.ts";
import * as publishPackagesModule from "../publishPackages.ts";

vi.mock("@changesets/git");
vi.mock("../publishPackages.ts");
vi.mock("../../publish-plan/getPublishPlan.ts");
vi.mock("../../../utils/tarball.ts");

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

  describe("When publishing from an artifact", () => {
    it("should run publishPackages in artifact mode", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        "packages/pkg-a/package.json": JSON.stringify({
          name: "pkg-a",
          version: "1.0.0",
        }),
        ".changeset/config.json": JSON.stringify(defaultConfig),
      });

      vi.mocked(tarball.extractTarball).mockImplementation(
        async (_tarballPath, targetDir) => {
          await fs.writeFile(
            `${targetDir}/publish-plan.json`,
            JSON.stringify([
              [
                {
                  kind: "publish",
                  name: "pkg-a",
                  version: "1.0.0",
                  access: "public",
                  registry: "https://registry.npmjs.org",
                  tag: "latest",
                  tarball: {
                    path: "packages/pkg-a-1.0.0.tgz",
                    checksum: "abc",
                  },
                },
              ],
            ]),
          );
        },
      );
      vi.mocked(publishPackagesModule.publishPackages).mockResolvedValue([
        { name: "pkg-a", version: "1.0.0", result: "published" },
      ]);

      await runRelease({ cwd, from: "changesets-pack.tgz" });

      expect(publishPackagesModule.publishPackages).toHaveBeenCalledWith({
        releases: [
          {
            kind: "publish",
            name: "pkg-a",
            version: "1.0.0",
            access: "public",
            registry: "https://registry.npmjs.org",
            tag: "latest",
            tarball: {
              path: "packages/pkg-a-1.0.0.tgz",
              checksum: "abc",
            },
          },
        ],
        packages: expect.objectContaining({
          packages: [
            expect.objectContaining({
              packageJson: expect.objectContaining({
                name: "pkg-a",
                version: "1.0.0",
              }),
            }),
          ],
        }),
        artifactDir: expect.stringContaining("changesets-publish-"),
        otp: undefined,
      });
    });

    it("should reject custom tags", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "package-lock.json": "",
        ".changeset/config.json": JSON.stringify(defaultConfig),
      });

      await expect(
        runRelease({ cwd, from: "changesets-pack.tgz", tag: "beta" }),
      ).rejects.toThrow();
    });
  });
});
