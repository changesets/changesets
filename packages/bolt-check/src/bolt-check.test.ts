import { getFixturePath, copyFixtureIntoTempDir } from "jest-fixtures";
import fs from "fs-extra";
import path from "path";
import boltCheck from "./bolt-check";

describe("bolt-check", () => {
  it("should validate a project with no errors", async () => {
    const cwd = await getFixturePath(__dirname, "yarn-workspace-base");

    const errors = await boltCheck({ cwd, silent: true });
    expect(errors).toEqual([]);
  });
  it("should error if a package contains an external dependency missing at root", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-missing-external"
    );

    const errors = await boltCheck({ cwd, silent: true });

    expect(errors).toEqual([
      {
        dependency: "get-workspaces",
        pkgName: "yarn-workspace-base-pkg-a",
        type: "missingDependency",
        pkgVersion: "^0.2.1"
      }
    ]);
  });
  it("should error if a package contains an external dependency at a mistmatched version", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-external"
    );

    const errors = await boltCheck({ cwd, silent: true });
    expect(errors).toEqual([
      {
        dependency: "get-workspaces",
        pkgName: "yarn-workspace-base-pkg-a",
        type: "externalMismatch",
        rootVersion: "^0.2.0",
        pkgVersion: "^0.2.1"
      }
    ]);
  });
  it("should error if a package contains an internal dependency at an incompatible version", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-internal"
    );

    const errors = await boltCheck({ cwd, silent: true });
    expect(errors).toEqual([
      {
        dependency: "yarn-workspace-base-pkg-b",
        pkgName: "yarn-workspace-base-pkg-a",
        type: "internalMismatch",
        version: "1.0.0"
      }
    ]);
  });
  it.skip("should print errors for both external and internal dependencies at once", async () => {
    throw new Error("write this test");
  });
  it.skip("should print multiple errors for multiple internal mismatches", async () => {
    throw new Error("write this test");
  });
  it.skip("should print multiple errors for multiple external mismatches", async () => {
    throw new Error("write this test");
  });
});

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

    await boltCheck({ cwd, fix: true });

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

    await boltCheck({ cwd, fix: true });
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

    await boltCheck({ cwd, fix: true });
    const pkgJSON = JSON.parse(await fs.readFileSync(pkgJSonPath, "utf-8"));

    expect(pkgJSON.dependencies["yarn-workspace-base-pkg-b"]).toEqual("^1.0.0");
  });
});
