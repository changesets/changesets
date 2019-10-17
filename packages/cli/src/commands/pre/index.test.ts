import fixturez from "fixturez";
import pre from "./index";
import * as fs from "fs-extra";
import path from "path";

const consoleError = console.error;

afterEach(async () => {
  jest.clearAllMocks();
  console.error = consoleError;
});

let f = fixturez(__dirname);

it("should work", async () => {
  let cwd = f.copy("simple-project");
  await pre(cwd, { tag: "next", command: "enter" });

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
