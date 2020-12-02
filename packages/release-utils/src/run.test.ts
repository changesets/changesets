import fixturez from "fixturez";
import fs from "fs-extra";
import path from "path";
import writeChangeset from "@changesets/write";
import { Changeset } from "@changesets/types";
import { runVersion } from "./run";
import { add, commit } from "@changesets/git";
import spawn from "spawndamnit";
import fileUrl from "file-url";

let f = fixturez(__dirname);

const linkNodeModules = async (cwd: string) => {
  await fs.symlink(
    path.join(__dirname, "..", "..", "..", "node_modules"),
    path.join(cwd, "node_modules")
  );
};
const writeChangesets = (changesets: Changeset[], cwd: string) => {
  return Promise.all(changesets.map(commit => writeChangeset(commit, cwd)));
};

beforeEach(() => {
  jest.clearAllMocks();
});

async function setupRepoAndClone(cwd: string) {
  await spawn("git", ["init"], { cwd });
  await add(".", cwd);
  await commit("commit1", cwd);

  // Make a 1-commit-deep shallow clone of this repo
  let clone = f.temp();
  await spawn(
    "git",
    // Note: a file:// URL is needed in order to make a shallow clone of
    // a local repo
    ["clone", "--depth", "1", fileUrl(cwd), "."],
    {
      cwd: clone
    }
  );
  await spawn("git", ["checkout", "-b", "some-other-branch"], { cwd });
  return clone;
}

describe("version", () => {
  it.only("creates simple PR", async () => {
    let cwd = f.copy("simple-project");

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "pkg-a",
              type: "minor"
            },
            {
              name: "pkg-b",
              type: "minor"
            }
          ],
          summary: "Awesome feature"
        }
      ],
      cwd
    );

    const clone = await setupRepoAndClone(cwd);

    await linkNodeModules(clone);

    await runVersion({
      cwd: clone
    });

    await spawn("git", ["checkout", "changeset-release/master"], { cwd });

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "package.json"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "{
        \\"name\\": \\"pkg-a\\",
        \\"version\\": \\"1.1.0\\",
        \\"dependencies\\": {
          \\"pkg-b\\": \\"1.1.0\\"
        }
      }
      "
    `);

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "package.json"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "{
        \\"name\\": \\"pkg-b\\",
        \\"version\\": \\"1.1.0\\"
      }
      "
    `);

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "CHANGELOG.md"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0
      ### Minor Changes

      - fdf577e: Awesome feature

      ### Patch Changes

      - Updated dependencies [fdf577e]
        - pkg-b@1.1.0
      "
    `);
    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "CHANGELOG.md"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "# pkg-b

      ## 1.1.0
      ### Minor Changes

      - fdf577e: Awesome feature
      "
    `);
  });

  it.only("only includes bumped packages in the PR body", async () => {
    let cwd = f.copy("simple-project");

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "pkg-a",
              type: "minor"
            }
          ],
          summary: "Awesome feature"
        }
      ],
      cwd
    );

    const clone = await setupRepoAndClone(cwd);

    await linkNodeModules(clone);

    await runVersion({
      cwd: clone
    });

    await spawn("git", ["checkout", "changeset-release/master"], { cwd });

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "package.json"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "{
        \\"name\\": \\"pkg-a\\",
        \\"version\\": \\"1.1.0\\",
        \\"dependencies\\": {
          \\"pkg-b\\": \\"1.0.0\\"
        }
      }
      "
    `);

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-b", "package.json"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "{
        \\"name\\": \\"pkg-b\\",
        \\"version\\": \\"1.0.0\\"
      }
      "
    `);

    expect(
      await fs.readFile(
        path.join(cwd, "packages", "pkg-a", "CHANGELOG.md"),
        "utf-8"
      )
    ).toMatchInlineSnapshot(`
      "# pkg-a

      ## 1.1.0
      ### Minor Changes

      - d8d2f4f: Awesome feature
      "
    `);
    await expect(
      fs.readFile(path.join(cwd, "packages", "pkg-b", "CHANGELOG.md"), "utf-8")
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("doesn't include ignored package that got a dependency update in the PR body", async () => {
    let cwd = f.copy("ignored-package");

    await writeChangesets(
      [
        {
          releases: [
            {
              name: "ignored-package-pkg-b",
              type: "minor"
            }
          ],
          summary: "Awesome feature"
        }
      ],
      cwd
    );

    const clone = await setupRepoAndClone(cwd);

    await linkNodeModules(clone);

    await runVersion({
      cwd
    });
  });
});
