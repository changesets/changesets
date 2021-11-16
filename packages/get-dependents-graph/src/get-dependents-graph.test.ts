import { getDependentsGraph } from "./index";

describe("getting the dependents graph", () => {
  it("should work with a basic setup", () => {
    const graph = getDependentsGraph(
      {
        root: {
          dir: ".",
          packageJson: { name: "root", version: "1.0.0" }
        },
        packages: [
          {
            dir: "foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              dependencies: {
                bar: "1.0.0"
              }
            }
          },
          {
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0"
            }
          }
        ],
        tool: "yarn"
      },
      { bumpVersionsWithWorkspaceProtocolOnly: true }
    );

    expect(graph).toEqual(
      new Map([
        ["foo", []],
        ["bar", []],
        ["root", []]
      ])
    );
  });

  it("should properly determine dependents if packages depend on the root", () => {
    const graph = getDependentsGraph(
      {
        root: {
          dir: ".",
          packageJson: { name: "root", version: "1.0.0" }
        },
        packages: [
          {
            dir: "foo",
            packageJson: {
              name: "foo",
              version: "1.0.0",
              dependencies: {
                bar: "workspace:*"
              },
              devDependencies: {
                root: "workspace:*"
              }
            }
          },
          {
            dir: "bar",
            packageJson: {
              name: "bar",
              version: "1.0.0",
              devDependencies: {
                root: "workspace:*"
              }
            }
          }
        ],
        tool: "yarn"
      },
      { bumpVersionsWithWorkspaceProtocolOnly: true }
    );

    expect(graph).toEqual(
      new Map([
        ["foo", []],
        ["bar", ["foo"]],
        ["root", ["foo", "bar"]]
      ])
    );
  });
});
