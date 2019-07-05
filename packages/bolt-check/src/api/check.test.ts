import { getFixturePath } from "jest-fixtures";
import check from "./check";

describe("check", () => {
  it("should validate a project with no errors", async () => {
    const cwd = await getFixturePath(__dirname, "yarn-workspace-base");

    const errors = await check({ cwd });
    expect(errors).toEqual([]);
  });
  it("should error if a package contains an external dependency missing at root", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-missing-external"
    );

    const errors = await check({ cwd });

    expect(errors).toEqual([
      {
        dependency: "get-workspaces",
        pkgName: "yarn-workspace-base-pkg-a",
        type: "missingDependency",
        pkgVersion: "^0.2.1"
      }
    ]);
  });
  it("should error if a package contains an external dependency at a mismatched version", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-external"
    );

    const errors = await check({ cwd });
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

    const errors = await check({ cwd });
    expect(errors).toEqual([
      {
        dependency: "yarn-workspace-base-pkg-b",
        pkgName: "yarn-workspace-base-pkg-a",
        type: "internalMismatch",
        version: "1.0.0"
      }
    ]);
  });
  it("should error if the root package.json contains devDeps", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-root-contains-dev-deps"
    );

    const errors = await check({ cwd });
    expect(errors).toEqual([
      {
        type: "rootContainsDevDeps"
      }
    ]);
  });
});
