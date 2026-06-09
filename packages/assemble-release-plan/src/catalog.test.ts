/**
 * Tests for pnpm catalog: protocol support.
 *
 * Two scenarios:
 *
 * 1. Dependency graph – a package that references an internal dep via "catalog:"
 *    should appear as a dependent in the graph (tested via getDependencyGraph in
 *    packages/get-dependents-graph).
 *
 * 2. Version propagation – when the internal dep is released, the catalog:-
 *    dependent should receive an automatic bump (tested here via assembleReleasePlan).
 */

import { defaultConfig } from "@changesets/config";
import assembleReleasePlan from "./";
import FakeFullState from "./test-utils";

// Mock the get-dependents-graph package so we can:
//  a) inject catalog contents via readPnpmCatalog
//  b) provide a dependency graph that already has the catalog: edge resolved
jest.mock("@changesets/get-dependents-graph", () => ({
  readPnpmCatalog: jest.fn().mockReturnValue({}),
  getDependentsGraph: jest.fn().mockReturnValue(new Map()),
}));

import {
  getDependentsGraph,
  readPnpmCatalog,
} from "@changesets/get-dependents-graph";

const mockGetDependentsGraph = getDependentsGraph as jest.MockedFunction<
  typeof getDependentsGraph
>;
const mockReadPnpmCatalog = readPnpmCatalog as jest.MockedFunction<
  typeof readPnpmCatalog
>;

describe("catalog: protocol – version propagation", () => {
  let setup: FakeFullState;

  beforeEach(() => {
    setup = new FakeFullState();
    setup.addPackage("pkg-b", "1.0.0");
  });

  it("bumps a dependent that references an internal package via catalog:", () => {
    // pkg-b depends on pkg-a via the catalog, resolved to ^1.0.0
    setup.updateDependency("pkg-b", "pkg-a", "catalog:");

    // Simulate the graph after catalog: resolution (pkg-a has pkg-b as a dependent)
    mockGetDependentsGraph.mockReturnValue(
      new Map([
        ["pkg-a", ["pkg-b"]],
        ["pkg-b", []],
        ["root", []],
      ])
    );

    // Provide the catalog so determineDependents can resolve the range
    mockReadPnpmCatalog.mockReturnValue({ "pkg-a": "^1.0.0" });

    setup.addChangeset({
      id: "major-bump",
      releases: [{ name: "pkg-a", type: "major" }],
    });

    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined
    );

    // pkg-a major bump: 1.0.0 → 2.0.0 (leaves the ^1.0.0 catalog range → pkg-b gets patched)
    expect(releases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "pkg-a", newVersion: "2.0.0" }),
        expect.objectContaining({ name: "pkg-b", newVersion: "1.0.1" }),
      ])
    );
    expect(releases.length).toBe(2);
  });

  it("does not bump a dependent when the catalog range is still satisfied", () => {
    // pkg-b depends on pkg-a via the catalog, resolved to ^1.0.0
    setup.updateDependency("pkg-b", "pkg-a", "catalog:");

    mockGetDependentsGraph.mockReturnValue(
      new Map([
        ["pkg-a", ["pkg-b"]],
        ["pkg-b", []],
        ["root", []],
      ])
    );

    // catalog range ^1.0.0 – a patch bump to 1.0.1 still satisfies it
    mockReadPnpmCatalog.mockReturnValue({ "pkg-a": "^1.0.0" });

    // defaultConfig uses updateInternalDependents: "out-of-range"
    // pkg-a patch bump: 1.0.0 → 1.0.1, semverSatisfies("1.0.1", "^1.0.0") = true → no bump
    const { releases } = assembleReleasePlan(
      setup.changesets,
      setup.packages,
      defaultConfig,
      undefined
    );

    // pkg-a goes to 1.0.1, still inside ^1.0.0 → pkg-b should NOT be bumped
    expect(releases.length).toBe(1);
    expect(releases[0].name).toBe("pkg-a");
    expect(releases[0].newVersion).toBe("1.0.1");
  });
});
