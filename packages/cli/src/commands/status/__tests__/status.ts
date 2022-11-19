import fs from "fs-extra";
import path from "path";
import * as git from "@changesets/git";
import { defaultConfig } from "@changesets/config";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import writeChangeset from "@changesets/write";

import status from "..";

import humanId from "human-id";

jest.mock("human-id");
jest.mock("@changesets/git");

describe("status", () => {
  silenceLogsInBlock();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should get the status for a simple changeset and return the release object", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);
    // @ts-ignore
    git.getChangedPackagesSinceRef.mockImplementation(() => [
      {
        packageJson: { name: "pkg-a", version: "1.0.0" },
        dir: "/fake/folder/doesnt/matter",
      },
    ]);

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd
    );
    const releaseObj = await status(cwd, {}, defaultConfig);
    expect(releaseObj).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "ascii",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "preState": undefined,
        "releases": [
          {
            "changesets": [
              "ascii",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });

  it("should exit early with a non-zero error code when there are changed packages but no changesets", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    // @ts-ignore
    jest.spyOn(process, "exit").mockImplementation(() => {});
    // @ts-ignore
    git.getChangedPackagesSinceRef.mockImplementation(() => [
      {
        packageJson: { name: "pkg-a", version: "1.0.0" },
        dir: "/fake/folder/doesnt/matter",
      },
    ]);

    await status(cwd, {}, defaultConfig);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("should not exit early with a non-zero error code when there are no changed packages", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    // @ts-ignore
    jest.spyOn(process, "exit").mockImplementation(() => {});
    // @ts-ignore
    git.getChangedPackagesSinceRef.mockImplementation(() => []);

    const releaseObj = await status(cwd, {}, defaultConfig);

    expect(process.exit).not.toHaveBeenCalled();
    expect(releaseObj).toEqual({
      changesets: [],
      releases: [],
      preState: undefined,
    });
  });

  it("should not exit early with a non-zero code when there are changed packages and also a changeset", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    // @ts-ignore
    jest.spyOn(process, "exit").mockImplementation(() => {});
    // @ts-ignore
    git.getChangedPackagesSinceRef.mockImplementation(() => [
      {
        packageJson: { name: "pkg-a", version: "1.0.0" },
        dir: "/fake/folder/doesnt/matter",
      },
    ]);
    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd
    );
    await status(cwd, {}, defaultConfig);

    expect(process.exit).not.toHaveBeenCalled();
  });

  it.skip("should respect the verbose flag", () => false);
  it("should respect the output flag", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
      ".changeset/config.json": JSON.stringify({}),
    });

    const output = "nonsense.json";

    // @ts-ignore
    git.getChangedPackagesSinceRef.mockImplementation(() => [
      {
        packageJson: { name: "pkg-a", version: "1.0.0" },
        dir: "/fake/folder/doesnt/matter",
      },
    ]);
    const changesetID = "ascii";
    // @ts-ignore
    humanId.mockReturnValueOnce(changesetID);

    await writeChangeset(
      {
        summary: "This is a summary",
        releases: [{ name: "pkg-a", type: "minor" }],
      },
      cwd
    );
    const probsUndefined = await status(cwd, { output }, defaultConfig);

    const releaseObj = await fs.readFile(path.join(cwd, output), "utf-8");

    expect(probsUndefined).toEqual(undefined);
    expect(JSON.parse(releaseObj)).toMatchInlineSnapshot(`
      {
        "changesets": [
          {
            "id": "ascii",
            "releases": [
              {
                "name": "pkg-a",
                "type": "minor",
              },
            ],
            "summary": "This is a summary",
          },
        ],
        "releases": [
          {
            "changesets": [
              "ascii",
            ],
            "name": "pkg-a",
            "newVersion": "1.1.0",
            "oldVersion": "1.0.0",
            "type": "minor",
          },
        ],
      }
    `);
  });
});
