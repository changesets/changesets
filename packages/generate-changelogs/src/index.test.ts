import generateChangelogs from ".";
import { Packages } from "@manypkg/get-packages";
import { ChangelogFunctions } from "@changesets/types";

const fakePackageObj: Packages = {
  packages: [
    {
      dir: "./",
      packageJson: {
        name: "pkg-a",
        version: "1.0.0"
      }
    },
    {
      dir: "./",
      packageJson: {
        name: "pkg-b",
        version: "1.0.0"
      }
    }
  ],
  tool: "yarn",
  root: {
    dir: "abc",
    packageJson: {
      name: "nope",
      version: "1.0.0"
    }
  }
};
const fakeChangelogFuncs: ChangelogFunctions = {
  getReleaseLine: release => Promise.resolve(release.summary),
  getDependencyReleaseLine: (changesets, updatedDeps) =>
    Promise.resolve(updatedDeps.map(({ name }) => name).join(", "))
};

describe("generate changelogs", () => {
  it("should generate one changelog", async () => {
    let changelogs = await generateChangelogs(
      [
        {
          name: "pkg-a",
          changesets: ["an-id"],
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
          type: "minor"
        }
      ],
      [
        {
          commit: "abc",
          summary: "some summary nonsense",
          releases: [{ name: "pkg-a", type: "minor" }],
          id: "an-id"
        }
      ],
      fakePackageObj,
      fakeChangelogFuncs
    );

    expect(changelogs.size).toEqual(1);
    expect(changelogs.get("pkg-a")).toEqual(`## 1.1.0
### Minor Changes

some summary nonsense
`);
  });
  it("should generate many changelogs", async () => {
    let changelogs = await generateChangelogs(
      [
        {
          name: "pkg-a",
          changesets: ["an-id"],
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
          type: "minor"
        },
        {
          name: "pkg-b",
          changesets: ["an-id"],
          oldVersion: "1.0.0",
          newVersion: "1.1.0",
          type: "minor"
        }
      ],
      [
        {
          commit: "abc",
          summary: "some summary nonsense",
          releases: [
            { name: "pkg-a", type: "minor" },
            { name: "pkg-b", type: "minor" }
          ],
          id: "an-id"
        }
      ],
      fakePackageObj,
      fakeChangelogFuncs
    );

    expect(changelogs.size).toEqual(2);
  });
});
