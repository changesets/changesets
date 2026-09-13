import { testdir } from "@changesets/test-utils";
import { describe, expect, it } from "vitest";
import { parseCatalogs, readCatalogs } from "./read.ts";

describe("parseCatalogs", () => {
  it("reads the default and named catalogs of a pnpm workspace", () => {
    const entries = parseCatalogs(
      `
packages:
  - packages/*

catalog:
  react: ^19.0.0

catalogs:
  react17:
    react: ^17.0.2
    react-dom: ^17.0.2
`,
      "pnpm-workspace",
    );

    expect(entries).toStrictEqual(
      new Map([
        ["default", new Map([["react", "^19.0.0"]])],
        [
          "react17",
          new Map([
            ["react", "^17.0.2"],
            ["react-dom", "^17.0.2"],
          ]),
        ],
      ]),
    );
  });

  it("merges `catalog` and `catalogs.default` into the default catalog", () => {
    expect(
      parseCatalogs(
        `
catalog:
  react: ^19.0.0

catalogs:
  default:
    lodash: ^4.17.21
`,
        "pnpm-workspace",
      ),
    ).toStrictEqual(
      new Map([
        [
          "default",
          new Map([
            ["react", "^19.0.0"],
            ["lodash", "^4.17.21"],
          ]),
        ],
      ]),
    );
  });

  it("reads the catalogs of a Yarn workspace", () => {
    expect(
      parseCatalogs(
        `
nodeLinker: node-modules

catalog:
  react: ^18.3.1
`,
        "yarnrc",
      ),
    ).toStrictEqual(new Map([["default", new Map([["react", "^18.3.1"]])]]));
  });

  it("prefers the catalogs under `workspaces` in a package.json", () => {
    expect(
      parseCatalogs(
        JSON.stringify({
          name: "root",
          workspaces: {
            packages: ["packages/*"],
            catalog: { react: "^19.0.0" },
          },
          catalog: { react: "^18.0.0" },
        }),
        "package-json",
      ),
    ).toStrictEqual(new Map([["default", new Map([["react", "^19.0.0"]])]]));
  });

  it("falls back to the catalogs at the root of a package.json", () => {
    expect(
      parseCatalogs(
        JSON.stringify({
          name: "root",
          workspaces: ["packages/*"],
          catalogs: { testing: { jest: "^30.0.0" } },
        }),
        "package-json",
      ),
    ).toStrictEqual(new Map([["testing", new Map([["jest", "^30.0.0"]])]]));
  });

  it("ignores entries that aren't version ranges", () => {
    expect(
      parseCatalogs(
        `
catalog:
  react: ^19.0.0
  broken:
    - nope
`,
        "pnpm-workspace",
      ),
    ).toStrictEqual(new Map([["default", new Map([["react", "^19.0.0"]])]]));
  });

  it("returns nothing for a malformed file", () => {
    expect(parseCatalogs("{ not json", "package-json").size).toBe(0);
  });
});

describe("readCatalogs", () => {
  it("reads the catalogs from pnpm-workspace.yaml", async () => {
    const cwd = await testdir({
      "pnpm-workspace.yaml": "catalog:\n  react: ^19.0.0\n",
      "package.json": JSON.stringify({ name: "root" }),
    });

    await expect(readCatalogs(cwd)).resolves.toStrictEqual({
      entries: new Map([["default", new Map([["react", "^19.0.0"]])]]),
      source: { format: "pnpm-workspace", filePath: "pnpm-workspace.yaml" },
    });
  });

  it("reads the catalogs from package.json when there is no other source", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: { packages: ["packages/*"], catalog: { react: "^19.0.0" } },
      }),
    });

    await expect(readCatalogs(cwd)).resolves.toStrictEqual({
      entries: new Map([["default", new Map([["react", "^19.0.0"]])]]),
      source: { format: "package-json", filePath: "package.json" },
    });
  });

  it("skips files that declare no catalogs", async () => {
    const cwd = await testdir({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": JSON.stringify({
        name: "root",
        catalog: { react: "^19.0.0" },
      }),
    });

    await expect(readCatalogs(cwd)).resolves.toMatchObject({
      source: { format: "package-json", filePath: "package.json" },
    });
  });

  it("returns no catalogs for a workspace that doesn't use them", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({ name: "root" }),
    });

    await expect(readCatalogs(cwd)).resolves.toStrictEqual({
      entries: new Map(),
      source: undefined,
    });
  });
});
