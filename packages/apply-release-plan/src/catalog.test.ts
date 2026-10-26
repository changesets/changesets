import fs from "node:fs/promises";
import path from "node:path";
import { withCatalogs } from "@changesets/catalogs";
import { defaultConfig } from "@changesets/config";
import { testdir } from "@changesets/test-utils";
import type { Config, ReleasePlan } from "@changesets/types";
import { getPackages } from "@manypkg/get-packages";
import { describe, expect, it } from "vitest";
import { applyReleasePlan } from "./index.ts";

const workspaceYaml = `packages:
  - packages/*

catalog:
  # the one everything shares
  pkg-a: ^1.0.0
  react: ^19.0.0

catalogs:
  internal:
    pkg-a: 1.0.0
`;

const releasePlan: ReleasePlan = {
  changesets: [
    {
      id: "quick-lions-devour",
      summary: "Hey, let's have fun with testing!",
      releases: [{ name: "pkg-a", type: "major" }],
    },
  ],
  releases: [
    {
      name: "pkg-a",
      type: "major",
      oldVersion: "1.0.0",
      newVersion: "2.0.0",
      changesets: ["quick-lions-devour"],
    },
    {
      name: "pkg-b",
      type: "patch",
      oldVersion: "1.0.0",
      newVersion: "1.0.1",
      changesets: [],
    },
  ],
  preState: undefined,
};

async function setup({
  dependencyRange = "catalog:",
  plan = releasePlan,
  ...overrides
}: {
  dependencyRange?: string;
  plan?: ReleasePlan;
  config?: Partial<Config>;
} = {}) {
  const cwd = await testdir({
    "package.json": JSON.stringify({ private: true, name: "root" }),
    "pnpm-workspace.yaml": workspaceYaml,
    "packages/pkg-a/package.json": JSON.stringify({
      name: "pkg-a",
      version: "1.0.0",
    }),
    "packages/pkg-b/package.json": JSON.stringify(
      {
        name: "pkg-b",
        version: "1.0.0",
        dependencies: { "pkg-a": dependencyRange, react: "catalog:" },
      },
      null,
      2,
    ),
  });

  const changedFiles = await applyReleasePlan(
    plan,
    await withCatalogs(await getPackages(cwd)),
    { ...defaultConfig, changelog: false, ...overrides.config },
  );

  return {
    cwd,
    changedFiles,
    catalogFile: () =>
      fs.readFile(path.join(cwd, "pnpm-workspace.yaml"), "utf8"),
    pkgB: async () =>
      JSON.parse(
        await fs.readFile(
          path.join(cwd, "packages/pkg-b/package.json"),
          "utf8",
        ),
      ),
  };
}

describe("catalog entries", () => {
  it("writes the new range to the catalog and leaves the rest of the file alone", async () => {
    const { catalogFile } = await setup();

    await expect(catalogFile()).resolves.toMatchInlineSnapshot(`
      "packages:
        - packages/*

      catalog:
        # the one everything shares
        pkg-a: ^2.0.0
        react: ^19.0.0

      catalogs:
        internal:
          pkg-a: 1.0.0
      "
    `);
  });

  it("keeps the dependents pointing at the catalog", async () => {
    const { pkgB } = await setup();

    await expect(pkgB()).resolves.toMatchObject({
      dependencies: { "pkg-a": "catalog:", react: "catalog:" },
    });
  });

  it("reports the catalog file as touched", async () => {
    const { cwd, changedFiles } = await setup();

    expect(changedFiles).toContain(path.join(cwd, "pnpm-workspace.yaml"));
  });

  it("only updates the catalog a dependent actually references", async () => {
    const { catalogFile } = await setup({
      dependencyRange: "catalog:internal",
    });

    const contents = await catalogFile();
    expect(contents).toContain("pkg-a: ^1.0.0");
    expect(contents).toContain("pkg-a: 2.0.0");
  });

  it("leaves the catalog alone with bumpVersionsWithWorkspaceProtocolOnly", async () => {
    const { catalogFile, changedFiles, cwd } = await setup({
      config: { bumpVersionsWithWorkspaceProtocolOnly: true },
    });

    await expect(catalogFile()).resolves.toBe(workspaceYaml);
    expect(changedFiles).not.toContain(path.join(cwd, "pnpm-workspace.yaml"));
  });

  it("refreshes the entry for a release that stays inside the range", async () => {
    const { catalogFile } = await setup({
      plan: {
        ...releasePlan,
        releases: [
          {
            name: "pkg-a",
            type: "patch",
            oldVersion: "1.0.0",
            newVersion: "1.0.1",
            changesets: ["quick-lions-devour"],
          },
        ],
      },
    });

    await expect(catalogFile()).resolves.toContain("pkg-a: ^1.0.1");
  });
});
