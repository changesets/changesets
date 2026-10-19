import { describe, expect, it } from "vitest";
import { updateCatalogEntries } from "./update.ts";

describe("updateCatalogEntries", () => {
  it("leaves comments and formatting of a pnpm workspace intact", () => {
    const contents = `packages:
  - packages/*

# The versions everything shares
catalog:
  # our own stuff
  "@scope/a": ^1.0.0
  react: ^19.0.0 # do not touch

catalogs:
  react17:
    react: '^17.0.2'
`;

    expect(
      updateCatalogEntries(contents, "pnpm-workspace", [
        { catalogName: "default", dependencyName: "@scope/a", value: "^2.0.0" },
        { catalogName: "react17", dependencyName: "react", value: "^17.1.0" },
      ]),
    ).toMatchInlineSnapshot(`
      "packages:
        - packages/*

      # The versions everything shares
      catalog:
        # our own stuff
        "@scope/a": ^2.0.0
        react: ^19.0.0 # do not touch

      catalogs:
        react17:
          react: '^17.1.0'
      "
    `);
  });

  it("updates an entry declared under `catalogs.default`", () => {
    expect(
      updateCatalogEntries(
        "catalogs:\n  default:\n    a: ^1.0.0\n",
        "pnpm-workspace",
        [{ catalogName: "default", dependencyName: "a", value: "^2.0.0" }],
      ),
    ).toBe("catalogs:\n  default:\n    a: ^2.0.0\n");
  });

  it("quotes ranges that would change meaning as a plain YAML scalar", () => {
    expect(
      updateCatalogEntries("catalog:\n  a: 1.0.0\n", "pnpm-workspace", [
        { catalogName: "default", dependencyName: "a", value: ">=2.0.0" },
      ]),
    ).toBe('catalog:\n  a: ">=2.0.0"\n');
  });

  it("ignores entries that don't exist", () => {
    const contents = "catalog:\n  a: ^1.0.0\n";
    expect(
      updateCatalogEntries(contents, "pnpm-workspace", [
        { catalogName: "default", dependencyName: "b", value: "^2.0.0" },
        { catalogName: "nope", dependencyName: "a", value: "^2.0.0" },
      ]),
    ).toBe(contents);
  });

  it("leaves the formatting of a package.json intact", () => {
    const contents = `{
  "name": "root",
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": { "@scope/a": "^1.0.0" },
    "catalogs": {
      "testing": { "jest": "^30.0.0" }
    }
  }
}
`;

    expect(
      updateCatalogEntries(contents, "package-json", [
        { catalogName: "default", dependencyName: "@scope/a", value: "^2.0.0" },
        { catalogName: "testing", dependencyName: "jest", value: "^31.0.0" },
      ]),
    ).toMatchInlineSnapshot(`
      "{
        "name": "root",
        "workspaces": {
          "packages": ["packages/*"],
          "catalog": { "@scope/a": "^2.0.0" },
          "catalogs": {
            "testing": { "jest": "^31.0.0" }
          }
        }
      }
      "
    `);
  });

  it("updates catalogs declared at the root of a package.json", () => {
    expect(
      updateCatalogEntries(
        '{ "workspaces": ["packages/*"], "catalog": { "a": "^1.0.0" } }',
        "package-json",
        [{ catalogName: "default", dependencyName: "a", value: "^2.0.0" }],
      ),
    ).toBe('{ "workspaces": ["packages/*"], "catalog": { "a": "^2.0.0" } }');
  });

  it("returns the contents as is when there is nothing to update", () => {
    expect(
      updateCatalogEntries("catalog:\n  a: ^1.0.0\n", "pnpm-workspace", []),
    ).toBe("catalog:\n  a: ^1.0.0\n");
  });
});
