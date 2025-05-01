import path from "node:path";
import { vi } from "vitest";
import stripAnsi from "strip-ansi";
import { temporarilySilenceLogs } from "@changesets/test-utils";
import getDependencyGraph from "./get-dependency-graph.ts";
import { Package } from "@manypkg/get-packages";
import { PnpmTool } from "@manypkg/tools";

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
      relativeDir: ".",
      packageJson: { name: "root", version: "1.0.0" },
    };
    const { graph, valid } = getDependencyGraph(
      {
        packages: [
          {
            dir: path.resolve("foo"),
            relativeDir: "foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              devDependencies: {
                bar: "link:../bar",
              },
            },
          },
          {
            dir: path.resolve("bar"),
            relativeDir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
        rootPackage,
        rootDir: path.resolve(),
        tool: PnpmTool,
      },
      rootPackage
    );
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it("should skip dependencies specified using a tag", function () {
    const rootPackage: Package = {
      dir: path.resolve(),
      relativeDir: ".",
      packageJson: { name: "root", version: "1.0.0" },
    };
    const { graph, valid } = getDependencyGraph(
      {
        packages: [
          {
            dir: path.resolve("examples/foo"),
            relativeDir: "examples/foo",
            packageJson: {
              name: "foo-example",
              version: "1.0.0",
              dependencies: {
                bar: "latest",
              },
            },
          },
          {
            dir: path.resolve("packages/bar"),
            relativeDir: "packages/bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
        rootPackage,
        rootDir: path.resolve(),
        tool: PnpmTool,
      },
      rootPackage
    );
    expect(graph.get("foo-example")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it(
    "should set valid to false if the link protocol is used in a non-dev dep",
    temporarilySilenceLogs(() => {
      const rootPackage: Package = {
        dir: path.resolve(),
        relativeDir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      };
      const { valid } = getDependencyGraph(
        {
          packages: [
            {
              dir: path.resolve("foo"),
              relativeDir: "foo",
              packageJson: {
                name: "foo",
                version: "1.0.0",
                dependencies: {
                  bar: "link:../bar",
                },
              },
            },
            {
              dir: path.resolve("bar"),
              relativeDir: "bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
          rootPackage,
          rootDir: path.resolve(),
          tool: PnpmTool,
        },
        rootPackage
      );
      expect(valid).toBeFalsy();
      expect((console.error as any).mock.calls).toHaveLength(1);
      expect(stripAnsi((console.error as any).mock.calls[0][0])).toBe(
        `Package "foo" must depend on the current version of "bar": "1.0.0" vs "link:../bar"`
      );
    })
  );
});
