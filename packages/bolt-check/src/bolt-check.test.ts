import boltCheck from "./bolt-check";
import { getFixturePath } from "jest-fixtures";

describe("bolt-check", () => {
  it("should validate a project with no errors", async () => {
    const cwd = await getFixturePath(__dirname, "yarn-workspace-base");

    const errors = await boltCheck({ cwd, silent: true });
    expect(errors).toEqual([]);
  });
  it("should error if a package contains an external dependency at a mistmatched version", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-version"
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
  it("should error if a package contains an internal dependency at an incompatible version", async () => {
    throw new Error("write this test");
  });
  it("should print errors for both external and internal dependencies at once", async () => {
    throw new Error("write this test");
  });
  it("should print multiple errors for multiple internal mismatches", async () => {
    throw new Error("write this test");
  });
  it("should print multiple errors for multiple external mismatches", async () => {
    throw new Error("write this test");
  });
});
