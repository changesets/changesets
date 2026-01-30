import { temporarilySilenceLogs } from "@changesets/test-utils";
import getDependencyGraph from "./get-dependency-graph";
import type { Tool } from "@manypkg/get-packages";

const consoleError = console.error;

beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = consoleError;
});

describe("getting the dependency graph", function () {
  it("should skip dependencies specified through the link protocol", function () {
    const { graph, valid } = getDependencyGraph({
      rootDir: "/",
      rootPackage: {
        relativeDir: ".",
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          relativeDir: ".",
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
          relativeDir: ".",
          dir: "bar",
          packageJson: {
            name: "bar",
            version: "1.0.0",
          },
        },
      ],
      tool: { type: "pnpm" } as Tool,
    });
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it("should skip dependencies specified using a tag", function () {
    const { graph, valid } = getDependencyGraph({
      rootDir: "/",
      rootPackage: {
        relativeDir: ".",
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          relativeDir: ".",
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
          relativeDir: ".",
          dir: "packages/bar",
          packageJson: {
            name: "bar",
            version: "1.0.0",
          },
        },
      ],
      tool: { type: "pnpm" } as Tool,
    });
    expect(graph.get("foo-example")!.dependencies).toStrictEqual([]);
    expect(valid).toBeTruthy();
    expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
  });

  it(
    "should set valid to false if the link protocol is used in a non-dev dep",
    temporarilySilenceLogs(() => {
      const { valid } = getDependencyGraph({
        rootDir: "/",
        rootPackage: {
          relativeDir: ".",
          dir: "root",
          packageJson: { name: "root", version: "1.0.0" },
        },
        packages: [
          {
            relativeDir: ".",
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
            relativeDir: ".",
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
        tool: { type: "pnpm" } as Tool,
      });
      expect(valid).toBeFalsy();
      expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
        [
          [
            "Package [36m"foo"[39m must depend on the current version of [36m"bar"[39m: [32m"1.0.0"[39m vs [31m"link:../bar"[39m",
          ],
        ]
      `);
    })
  );

  it(
    "should error on dependencies not specified using workspace protocol when bumpVersionsWithWorkspaceProtocolOnly is false",
    temporarilySilenceLogs(() => {
      const { valid } = getDependencyGraph({
        rootDir: "/",
        rootPackage: {
          relativeDir: ".",
          dir: ".",
          packageJson: { name: "root", version: "1.0.0" },
        },
        packages: [
          {
            relativeDir: ".",
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
            relativeDir: ".",
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
            },
          },
        ],
        tool: { type: "pnpm" } as Tool,
      });
      expect(valid).toBe(false);
      expect((console.error as any).mock.calls).toMatchInlineSnapshot(`
        [
          [
            "Package [36m"foo"[39m must depend on the current version of [36m"bar"[39m: [32m"1.0.0"[39m vs [31m"0.9.0"[39m",
          ],
        ]
      `);
    })
  );

  it(
    "should skip dependencies not specified using workspace protocol when bumpVersionsWithWorkspaceProtocolOnly is true",
    temporarilySilenceLogs(() => {
      const { valid } = getDependencyGraph(
        {
          rootDir: "/",
          rootPackage: {
            relativeDir: ".",
            dir: "root",
            packageJson: { name: "root", version: "1.0.0" },
          },
          packages: [
            {
              relativeDir: ".",
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
              relativeDir: ".",
              dir: "bar",
              packageJson: {
                name: "bar",
                version: "1.0.0",
              },
            },
          ],
          tool: { type: "pnpm" } as Tool,
        },
        {
          bumpVersionsWithWorkspaceProtocolOnly: true,
        }
      );
      expect(valid).toBe(true);
      expect((console.error as any).mock.calls).toMatchInlineSnapshot(`[]`);
    })
  );
});
