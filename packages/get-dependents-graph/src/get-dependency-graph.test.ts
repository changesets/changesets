import { vi } from "vitest";
import stripAnsi from "strip-ansi";
import { temporarilySilenceLogs } from "@changesets/test-utils";
import getDependencyGraph from "./get-dependency-graph.ts";

const consoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = consoleError;
});

describe("getting the dependency graph", function () {
  it("should skip dependencies specified through the link protocol", function () {
    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
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
      tool: "pnpm",
    });
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it("should skip dependencies specified using a tag", function () {
    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
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
      tool: "pnpm",
    });
    expect(graph.get("foo-example")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it(
    "should set valid to false if the link protocol is used in a non-dev dep",
    temporarilySilenceLogs(() => {
      const { valid } = getDependencyGraph({
        root: {
          dir: ".",
          packageJson: { name: "root", version: "1.0.0" },
        },
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
        tool: "pnpm",
      });
      expect(valid).toBeFalsy();
      expect((console.error as any).mock.calls).toHaveLength(1);
      expect(stripAnsi((console.error as any).mock.calls[0][0])).toBe(
        `Package "foo" must depend on the current version of "bar": "1.0.0" vs "link:../bar"`
      );
    })
  );
});
