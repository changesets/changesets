import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import * as git from "@changesets/git";
import tag from "../index";
import { parsePackage, replacePlaceholders } from "../parsePackage";

jest.mock("@changesets/git");

describe("tag command", () => {
  silenceLogsInBlock();

  describe("workspace project", () => {
    it("tags all packages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
      });

      (git.getAllTags as jest.Mock).mockReturnValue(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-a@1.0.0");
      expect((git.tag as jest.Mock).mock.calls[1][0]).toEqual("pkg-b@1.0.0");
    });

    it("skips tags that already exist", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
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
      });

      (git.getAllTags as jest.Mock).mockReturnValue(
        new Set([
          // pkg-a should not be re-tagged
          "pkg-a@1.0.0",
        ])
      );

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("pkg-b@1.0.0");
    });
  });

  describe("single package repo", () => {
    it("uses a simplified version-only tag", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          name: "root-only",
          version: "1.0.0",
        }),
      });
      (git.getAllTags as jest.Mock).mockReturnValue(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(1);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual("v1.0.0");

      // format git tag
      await tag(cwd, "{projectName}@{version}");
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect((git.tag as jest.Mock).mock.calls[1][0]).toEqual(
        "root-only@1.0.0"
      );
    });
  });

  describe("custom format", () => {
    describe("parsePackage", () => {
      it("no-scoped package", () => {
        const result = parsePackage({
          name: "pkg-a",
          version: "1.0.0",
        });
        expect(result).toEqual({
          organizationName: undefined,
          packageName: "pkg-a",
          projectName: "pkg-a",
          version: "1.0.0",
        });
      });

      it("scoped package", () => {
        const result = parsePackage({
          name: "@scope/pkg-a",
          version: "1.0.0",
        });
        expect(result).toEqual({
          organizationName: "scope",
          packageName: "@scope/pkg-a",
          projectName: "pkg-a",
          version: "1.0.0",
        });
      });
      it("invalid package name 01", () => {
        const result = parsePackage({
          name: "my_package",
          version: "1.0.0",
        });
        expect(result).toEqual({
          organizationName: undefined,
          packageName: "my_package",
          projectName: "my_package",
          version: "1.0.0",
        });
      });
      it("invalid package name 02", () => {
        const result = parsePackage({
          name: "@my-package@1.0.0",
          version: "1.0.0",
        });
        expect(result).toEqual({
          organizationName: undefined,
          packageName: "@my-package@1.0.0",
          projectName: "@my-package@1.0.0",
          version: "1.0.0",
        });
      });
    });

    describe("replacePlaceholders", () => {
      it("no-scoped package", () => {
        const result = parsePackage({
          name: "pkg-a",
          version: "1.0.0",
        });

        // ====== case ======
        expect(replacePlaceholders(result)).toEqual("pkg-a@1.0.0");
        expect(replacePlaceholders(result, "")).toEqual("pkg-a@1.0.0");
        expect(replacePlaceholders(result, "{organizationName}")).toEqual(
          "{organizationName}"
        );
        expect(replacePlaceholders(result, "{packageName}")).toEqual("pkg-a");
        expect(replacePlaceholders(result, "{projectName}")).toEqual("pkg-a");
        expect(replacePlaceholders(result, "v{version}")).toEqual("v1.0.0");
        expect(replacePlaceholders(result, "{projectName}@{version}")).toEqual(
          "pkg-a@1.0.0"
        );
        expect(replacePlaceholders(result, "{packageName}@{version}")).toEqual(
          "pkg-a@1.0.0"
        );
        expect(
          replacePlaceholders(
            result,
            "@{organizationName}/{projectName}@{version}"
          )
        ).toEqual("@{organizationName}/pkg-a@1.0.0");
      });

      it("scoped package", () => {
        const result = parsePackage({
          name: "@scope/pkg-a",
          version: "1.0.0",
        });

        // ====== case ======
        expect(replacePlaceholders(result)).toEqual("@scope/pkg-a@1.0.0");
        expect(replacePlaceholders(result, "")).toEqual("@scope/pkg-a@1.0.0");
        expect(replacePlaceholders(result, "{organizationName}")).toEqual(
          "scope"
        );
        expect(replacePlaceholders(result, "{packageName}")).toEqual(
          "@scope/pkg-a"
        );
        expect(replacePlaceholders(result, "{projectName}")).toEqual("pkg-a");
        expect(replacePlaceholders(result, "v{version}")).toEqual("v1.0.0");
        expect(replacePlaceholders(result, "{projectName}@{version}")).toEqual(
          "pkg-a@1.0.0"
        );
        expect(replacePlaceholders(result, "{packageName}@{version}")).toEqual(
          "@scope/pkg-a@1.0.0"
        );
        expect(
          replacePlaceholders(
            result,
            "@{organizationName}/{projectName}@{version}"
          )
        ).toEqual("@scope/pkg-a@1.0.0");
      });
    });

    it("tags all packages", async () => {
      const cwd = await testdir({
        "package.json": JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
        }),
        "packages/foo/package.json": JSON.stringify({
          name: "@company/foo",
          version: "1.0.0",
        }),
        "packages/bar/package.json": JSON.stringify({
          name: "@company/bar",
          version: "1.0.0",
        }),
      });

      (git.getAllTags as jest.Mock).mockReturnValue(new Set());

      expect(git.tag).not.toHaveBeenCalled();
      await tag(cwd);
      expect(git.tag).toHaveBeenCalledTimes(2);
      expect((git.tag as jest.Mock).mock.calls[0][0]).toEqual(
        "@company/bar@1.0.0"
      );
      expect((git.tag as jest.Mock).mock.calls[1][0]).toEqual(
        "@company/foo@1.0.0"
      );

      // format git tag
      await tag(cwd, "{projectName}@v{version}");
      expect(git.tag).toHaveBeenCalledTimes(4);
      expect((git.tag as jest.Mock).mock.calls[2][0]).toEqual("bar@v1.0.0");
      expect((git.tag as jest.Mock).mock.calls[3][0]).toEqual("foo@v1.0.0");

      // format git tag
      await tag(cwd, "@{organizationName}/{projectName}-v{version}");
      expect(git.tag).toHaveBeenCalledTimes(6);
      expect((git.tag as jest.Mock).mock.calls[4][0]).toEqual(
        "@company/bar-v1.0.0"
      );
      expect((git.tag as jest.Mock).mock.calls[5][0]).toEqual(
        "@company/foo-v1.0.0"
      );
    });
  });
});
