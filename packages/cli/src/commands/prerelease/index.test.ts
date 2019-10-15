import { copyFixtureIntoTempDir } from "jest-fixtures";
import prerelease from "./index";
import { defaultConfig } from "@changesets/config";
import * as fs from "fs-extra";
import path from "path";

let cwd: string;

const consoleError = console.error;

beforeEach(async () => {
  cwd = await copyFixtureIntoTempDir(__dirname, "simple-project");
  console.error = jest.fn();
});

afterEach(async () => {
  jest.clearAllMocks();
  console.error = consoleError;
});

it("should work", async () => {
  await prerelease(cwd, { tag: "next", command: "enter" }, defaultConfig);

  expect(await fs.readJson(path.join(cwd, ".changeset", "pre.json")))
    .toMatchInlineSnapshot(`
    Object {
      "mode": "pre",
      "packages": Object {
        "pkg-a": Object {
          "highestVersionType": null,
          "initialVersion": "1.0.0",
          "releaseLines": Object {
            "major": Array [],
            "minor": Array [],
            "patch": Array [],
          },
        },
        "pkg-b": Object {
          "highestVersionType": null,
          "initialVersion": "1.0.0",
          "releaseLines": Object {
            "major": Array [],
            "minor": Array [],
            "patch": Array [],
          },
        },
      },
      "tag": "next",
      "version": -1,
    }
  `);
});
