import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { temporarilySilenceLogs } from "@changesets/test-utils";
import type { Package } from "@changesets/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDependencyGraph } from "./get-dependency-graph.ts";

const consoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = consoleError;
});

describe("getting the dependency graph", function () {
  it("should skip dependencies specified through the link protocol", function () {
    const rootPackage: Package = {
      dir: path.resolve(),
      packageJson: { name: "root", version: "1.0.0" },
    };
    const { graph, warnings } = getDependencyGraph(
      {
        tool: { type: "yarn" },
        rootDir: rootPackage.dir,
        rootPackage,
        packages: [
          {
            dir: "foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              devDependencies: {
                bar: "link:../bar",
              },
            },
          },
          {
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
      },
      rootPackage,
    );
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(warnings).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("should skip dependencies specified using a tag", function () {
    const rootPackage: Package = {
      dir: path.resolve(),
      packageJson: { name: "root", version: "1.0.0" },
    };
    const { graph, warnings } = getDependencyGraph(
      {
        tool: { type: "yarn" },
        rootDir: rootPackage.dir,
        rootPackage,
        packages: [
          {
            dir: "examples/foo",
            packageJson: {
              name: "foo-example",
              version: "1.0.0",
              dependencies: {
                bar: "latest",
              },
            },
          },
          {
            dir: "packages/bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
      },
      rootPackage,
    );
    expect(graph.get("foo-example")!.dependencies).toStrictEqual([]);
    expect(warnings).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it(
    "should add warning if the link protocol is used in a non-dev dep",
    temporarilySilenceLogs(() => {
      const rootPackage: Package = {
        dir: path.resolve(),
        packageJson: { name: "root", version: "1.0.0" },
      };
      const { warnings } = getDependencyGraph(
        {
          tool: { type: "yarn" },
          rootDir: rootPackage.dir,
          rootPackage,
          packages: [
            {
              dir: "foo",
              packageJson: {
                name: "foo",
                version: "1.0.0",
                dependencies: {
                  bar: "link:../bar",
                },
              },
            },
            {
              dir: "bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
        },
        rootPackage,
      );
      expect(stripVTControlCharacters(warnings[0])).toEqual(
        "Package foo must depend on the current version of bar: 1.0.0 vs link:../bar",
      );
    }),
  );

  it(
    "should error on dependencies not specified using workspace protocol when bumpVersionsWithWorkspaceProtocolOnly is false",
    temporarilySilenceLogs(() => {
      const rootPackage: Package = {
        dir: path.resolve(),
        packageJson: { name: "root", version: "1.0.0" },
      };
      const { warnings } = getDependencyGraph(
        {
          tool: { type: "yarn" },
          rootDir: rootPackage.dir,
          rootPackage,
          packages: [
            {
              dir: "foo",
              packageJson: {
                name: "foo",
                version: "1.0.0",
                dependencies: {
                  bar: "0.9.0",
                },
              },
            },
            {
              dir: "bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
        },
        rootPackage,
      );

      expect(stripVTControlCharacters(warnings[0])).toEqual(
        "Package foo must depend on the current version of bar: 1.0.0 vs 0.9.0",
      );
    }),
  );

  it(
    "should skip dependencies not specified using workspace protocol when bumpVersionsWithWorkspaceProtocolOnly is true",
    temporarilySilenceLogs(() => {
      const rootPackage: Package = {
        dir: path.resolve(),
        packageJson: { name: "root", version: "1.0.0" },
      };
      const { warnings } = getDependencyGraph(
        {
          tool: { type: "yarn" },
          rootDir: rootPackage.dir,
          rootPackage,
          packages: [
            {
              dir: "foo",
              packageJson: {
                name: "foo",
                version: "1.0.0",
                dependencies: {
                  bar: "0.9.0",
                },
              },
            },
            {
              dir: "bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
        },
        rootPackage,
        {
          bumpVersionsWithWorkspaceProtocolOnly: true,
        },
      );
      expect(warnings).toHaveLength(0);
      expect(console.error).not.toHaveBeenCalled();
    }),
  );

  it("should treat workspace path dependencies as valid local dependencies", () => {
    const rootPackage: Package = {
      dir: path.resolve(),
      packageJson: { name: "root", version: "1.0.0" },
    };
    const { graph, warnings } = getDependencyGraph(
      {
        tool: { type: "pnpm" },
        rootDir: rootPackage.dir,
        rootPackage,
        packages: [
          {
            dir: "packages/foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              dependencies: {
                bar: "workspace:packages/bar",
              },
            },
          },
          {
            dir: "packages/bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
      },
      rootPackage,
    );

    expect(graph.get("foo")!.dependencies).toStrictEqual(["bar"]);
    expect(warnings).toHaveLength(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it(
    "should error on mismatched workspace path dependencies",
    temporarilySilenceLogs(() => {
      const rootPackage: Package = {
        dir: path.resolve(),
        packageJson: { name: "root", version: "1.0.0" },
      };
      const { graph, warnings } = getDependencyGraph(
        {
          tool: { type: "pnpm" },
          rootDir: rootPackage.dir,
          rootPackage,
          packages: [
            {
              dir: "packages/foo",
              packageJson: {
                name: "foo",
                version: "1.0.0",
                dependencies: {
                  bar: "workspace:packages/not-bar",
                },
              },
            },
            {
              dir: "packages/bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
        },
        rootPackage,
      );

      expect(graph.get("foo")!.dependencies).toStrictEqual([]);

      expect(stripVTControlCharacters(warnings[0])).toEqual(
        "Package foo must depend on the current version of bar: 1.0.0 vs workspace:packages/not-bar",
      );
    }),
  );
});
