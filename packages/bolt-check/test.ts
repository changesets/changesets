import spawn from "spawndamnit";
import stripAnsi from "strip-ansi";
import { getFixturePath } from "jest-fixtures";

describe("Integration test", () => {
  it("should print errors for missing external dep", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-missing-external"
    );
    let { stderr } = await spawn(`${__dirname}/bin.js`, [], { cwd });
    expect(stripAnsi(stderr.toString())).toBe(`there are errors in your config!
get-workspaces is a dependency of yarn-workspace-base-pkg-a, but is not found in the project root.
`);
  });

  it("should print errors for mismatched internal dep", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-internal"
    );
    let { stderr } = await spawn(`${__dirname}/bin.js`, [], { cwd });

    expect(stripAnsi(stderr.toString())).toBe(`there are errors in your config!
yarn-workspace-base-pkg-a needs to update its dependency on yarn-workspace-base-pkg-b to be compatible with 1.0.0
`);
  });

  it("should print errors for mismatched external dep", async () => {
    const cwd = await getFixturePath(
      __dirname,
      "yarn-workspace-mismatched-external"
    );
    let { stderr } = await spawn(`${__dirname}/bin.js`, [], { cwd });
    expect(stripAnsi(stderr.toString())).toBe(`there are errors in your config!
yarn-workspace-base-pkg-a relies on get-workspaces at ^0.2.1, but your project relies on  get-workspaces at ^0.2.0.
`);
  });

  it.skip("should print multiple errors for multiple internal mismatches", async () => {
    throw new Error("write this test");
  });
  it.skip("should print multiple errors for multiple external mismatches", async () => {
    throw new Error("write this test");
  });
});
