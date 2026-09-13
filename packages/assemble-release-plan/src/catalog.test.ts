import { defaultConfig } from "@changesets/config";
import type { Catalogs } from "@changesets/types";
import { describe, expect, it } from "vitest";
import { assembleReleasePlan } from "./index.ts";
import { FakeFullState } from "./test-utils.ts";

const catalogs = (
  entries: Record<string, Record<string, string>>,
): Catalogs => ({
  entries: new Map(
    Object.entries(entries).map(([name, catalog]) => [
      name,
      new Map(Object.entries(catalog)),
    ]),
  ),
  source: undefined,
});

describe("dependencies referenced through a catalog", () => {
  it("bumps a dependent when the release leaves the catalog range", () => {
    const setup = new FakeFullState();
    setup.addPackage("pkg-b", "1.0.0");
    setup.updateDependency("pkg-b", "pkg-a", "catalog:");
    setup.packages.catalogs = catalogs({ default: { "pkg-a": "^1.0.0" } });

    setup.addChangeset({
      id: "major-bump",
      releases: [{ name: "pkg-a", type: "major" }],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases).toEqual([
      expect.objectContaining({ name: "pkg-a", newVersion: "2.0.0" }),
      expect.objectContaining({ name: "pkg-b", newVersion: "1.0.1" }),
    ]);
  });

  it("does not bump a dependent while the catalog range still matches", () => {
    const setup = new FakeFullState();
    setup.addPackage("pkg-b", "1.0.0");
    setup.updateDependency("pkg-b", "pkg-a", "catalog:");
    setup.packages.catalogs = catalogs({ default: { "pkg-a": "^1.0.0" } });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases).toEqual([
      expect.objectContaining({ name: "pkg-a", newVersion: "1.0.1" }),
    ]);
  });

  it("resolves references to a named catalog", () => {
    const setup = new FakeFullState();
    setup.addPackage("pkg-b", "1.0.0");
    setup.updateDependency("pkg-b", "pkg-a", "catalog:internal");
    setup.packages.catalogs = catalogs({
      default: { "pkg-a": "^1.0.0" },
      internal: { "pkg-a": "1.0.0" },
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    // the `internal` catalog pins 1.0.0, so the patch release takes pkg-b with it
    expect(releases).toEqual([
      expect.objectContaining({ name: "pkg-a", newVersion: "1.0.1" }),
      expect.objectContaining({ name: "pkg-b", newVersion: "1.0.1" }),
    ]);
  });

  it("ignores a reference the catalogs don't define", () => {
    const setup = new FakeFullState();
    setup.addPackage("pkg-b", "1.0.0");
    setup.updateDependency("pkg-b", "pkg-a", "catalog:");
    setup.packages.catalogs = catalogs({ default: { react: "^19.0.0" } });

    setup.addChangeset({
      id: "major-bump",
      releases: [{ name: "pkg-a", type: "major" }],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined,
    );

    expect(releases).toEqual([
      expect.objectContaining({ name: "pkg-a", newVersion: "2.0.0" }),
    ]);
  });
});
