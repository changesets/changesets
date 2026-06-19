import fs from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "@changesets/config";
import * as git from "@changesets/git";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as npmUtils from "../npm-utils.ts";
import { publish as runRelease } from "../index.ts";
import * as publishPackagesModule from "../publishPackages.ts";

vi.mock("@changesets/git");
vi.mock("../publishPackages.ts");
vi.mock("../npm-utils.ts");

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
      vi.mocked(npmUtils.infoAllow404).mockResolvedValue({
        published: false,
        pkgInfo: { version: "1.0.0" },
      });
      vi.mocked(npmUtils.getCorrectRegistry).mockReturnValue({
        registry: "https://registry.npmjs.org",
      });
      vi.mocked(publishPackagesModule.publishPackages).mockResolvedValue([
        { name: "pkg-a", version: "1.1.0", result: "published" },
        { name: "pkg-b", version: "1.0.1", result: "published" },
      ]);

      await runRelease({ cwd });

      expect(publishPackagesModule.publishPackages).toHaveBeenCalled();
    });
  });

  describe("When publishing from a pack directory", () => {
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
      const packDir = path.join(cwd, ".packed");
      await fs.mkdir(path.join(packDir, "packages"), { recursive: true });
      await fs.writeFile(
        path.join(packDir, "publish-plan.json"),
        JSON.stringify(
          {
            version: 1,
            plan: [
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
                    integrity: "sha256-abc",
                  },
                },
              ],
            ],
          },
          undefined,
          2,
        ),
      );
      vi.mocked(publishPackagesModule.publishPackages).mockResolvedValue([
        { name: "pkg-a", version: "1.0.0", result: "published" },
      ]);

      await runRelease({ cwd, fromPackDir: ".packed" });

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
              integrity: "sha256-abc",
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
        access: "restricted",
        artifactDir: packDir,
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
        runRelease({ cwd, fromPackDir: ".packed", tag: "beta" }),
      ).rejects.toThrow();
    });
  });
});
