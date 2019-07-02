import { copyFixtureIntoTempDir } from "jest-fixtures";
import fs from "fs-extra";
import path from "path";
import check from "./check";
import fix from "./fix";

describe("fix", () => {
  describe("bolt-check --fix", () => {
    it("should error if a package contains an external dependency missing at root", async () => {
      const cwd = await copyFixtureIntoTempDir(
        __dirname,
        "yarn-workspace-missing-external"
      );

      const pkgJSonPath = path.join(cwd, "package.json");
      const pkgJSONOriginal = JSON.parse(
        await fs.readFileSync(pkgJSonPath, "utf-8")
      );

      expect(pkgJSONOriginal.dependencies["get-workspaces"]).toBeUndefined();

      const errors = await check({ cwd });
      await fix(errors, { cwd });

      const pkgJSON = JSON.parse(await fs.readFileSync(pkgJSonPath, "utf-8"));

      expect(pkgJSON.dependencies["get-workspaces"]).toEqual("^0.2.1");
    });
    it("should error if a package contains an external dependency at a mistmatched version", async () => {
      const cwd = await copyFixtureIntoTempDir(
        __dirname,
        "yarn-workspace-mismatched-external"
      );

      const pkgJSonPath = path.join(cwd, "packages", "pkg-a", "package.json");
      const pkgJSONOriginal = JSON.parse(
        await fs.readFileSync(pkgJSonPath, "utf-8")
      );

      expect(pkgJSONOriginal.dependencies["get-workspaces"]).toEqual("^0.2.1");

      const errors = await check({ cwd });
      await fix(errors, { cwd });
      const pkgJSON = JSON.parse(await fs.readFileSync(pkgJSonPath, "utf-8"));

      expect(pkgJSON.dependencies["get-workspaces"]).toEqual("^0.2.0");
    });
    it("should error if a package contains an internal dependency at an incompatible version", async () => {
      const cwd = await copyFixtureIntoTempDir(
        __dirname,
        "yarn-workspace-mismatched-internal"
      );
      const pkgJSonPath = path.join(cwd, "packages", "pkg-a", "package.json");
      const pkgJSONOriginal = JSON.parse(
        await fs.readFileSync(pkgJSonPath, "utf-8")
      );

      expect(pkgJSONOriginal.dependencies["yarn-workspace-base-pkg-b"]).toEqual(
        "^0.1.0"
      );

      const errors = await check({ cwd });
      await fix(errors, { cwd });
      const pkgJSON = JSON.parse(await fs.readFileSync(pkgJSonPath, "utf-8"));

      expect(pkgJSON.dependencies["yarn-workspace-base-pkg-b"]).toEqual(
        "^1.0.0"
      );
    });
    it("should move devDeps to deps if the root package.json contains devDeps", async () => {
      const cwd = await copyFixtureIntoTempDir(
        __dirname,
        "yarn-workspace-root-contains-dev-deps"
      );

      const errors = await check({ cwd });
      await fix(errors, { cwd });
      const pkgJSON = JSON.parse(
        await fs.readFile(path.join(cwd, "package.json"), "utf-8")
      );
      expect(pkgJSON.devDependencies).toBeUndefined();
      expect(pkgJSON.dependencies).toEqual({
        react: "^16.8.6",
        "react-test-renderer": "^16.8.6"
      });
    });
  });
});
