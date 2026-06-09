import getDependencyGraph from "./get-dependency-graph";

// Mock readPnpmCatalog so tests don't touch the filesystem
jest.mock("./read-pnpm-catalog", () => ({
  readPnpmCatalog: jest.fn(),
}));

import { readPnpmCatalog } from "./read-pnpm-catalog";

const mockReadPnpmCatalog = readPnpmCatalog as jest.MockedFunction<
  typeof readPnpmCatalog
>;

beforeEach(() => {
  mockReadPnpmCatalog.mockReturnValue({});
});

describe("catalog: protocol in dependency graph", () => {
  it("includes a catalog:-referenced internal package as a dependency", () => {
    mockReadPnpmCatalog.mockReturnValue({ bar: "^1.0.0" });

    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "packages/foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            dependencies: {
              bar: "catalog:",
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

    expect(graph.get("foo")!.dependencies).toStrictEqual(["bar"]);
    expect(valid).toBe(true);
  });

  it("ignores a catalog: reference when the dep is not an internal package", () => {
    mockReadPnpmCatalog.mockReturnValue({ react: "^18.3.1" });

    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "packages/foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            dependencies: {
              react: "catalog:",
            },
          },
        },
      ],
      tool: "pnpm",
    });

    // react is not in the workspace, so no dependency edge is created
    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBe(true);
  });

  it("skips a catalog: reference when the dep name is absent from the catalog", () => {
    // catalog is empty — the entry for bar is missing
    mockReadPnpmCatalog.mockReturnValue({});

    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "packages/foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            dependencies: {
              bar: "catalog:",
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

    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBe(true);
  });

  it("does not crash when pnpm-workspace.yaml is absent (empty catalog)", () => {
    // readPnpmCatalog returns {} when the file is missing
    mockReadPnpmCatalog.mockReturnValue({});

    const { graph, valid } = getDependencyGraph({
      root: {
        dir: "/no/such/dir",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "/no/such/dir/packages/foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            dependencies: { bar: "catalog:" },
          },
        },
        {
          dir: "/no/such/dir/packages/bar",
          packageJson: { name: "bar", version: "1.0.0" },
        },
      ],
      tool: "pnpm",
    });

    expect(graph.get("foo")!.dependencies).toStrictEqual([]);
    expect(valid).toBe(true);
  });

  it("handles a catalog: dep alongside a regular semver dep", () => {
    mockReadPnpmCatalog.mockReturnValue({ baz: "^2.0.0" });

    const { graph, valid } = getDependencyGraph({
      root: {
        dir: ".",
        packageJson: { name: "root", version: "1.0.0" },
      },
      packages: [
        {
          dir: "packages/foo",
          packageJson: {
            name: "foo",
            version: "1.0.0",
            dependencies: {
              bar: "^1.0.0",
              baz: "catalog:",
            },
          },
        },
        {
          dir: "packages/bar",
          packageJson: { name: "bar", version: "1.0.0" },
        },
        {
          dir: "packages/baz",
          packageJson: { name: "baz", version: "2.0.0" },
        },
      ],
      tool: "pnpm",
    });

    expect(graph.get("foo")!.dependencies).toStrictEqual(["bar", "baz"]);
    expect(valid).toBe(true);
  });
});
