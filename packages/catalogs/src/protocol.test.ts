import { describe, expect, it } from "vitest";
import {
  getChangedCatalogEntries,
  parseCatalogProtocol,
  resolveCatalogRange,
} from "./protocol.ts";

const catalogs = {
  entries: new Map([
    ["default", new Map([["react", "^18.3.1"]])],
    ["react17", new Map([["react", "^17.0.2"]])],
  ]),
  source: undefined,
};

describe("parseCatalogProtocol", () => {
  it("returns the default catalog for a bare reference", () => {
    expect(parseCatalogProtocol("catalog:")).toBe("default");
  });

  it("returns the default catalog for an explicit default reference", () => {
    expect(parseCatalogProtocol("catalog:default")).toBe("default");
  });

  it("returns the name of a named catalog", () => {
    expect(parseCatalogProtocol("catalog:react17")).toBe("react17");
  });

  it("ignores surrounding whitespace", () => {
    expect(parseCatalogProtocol("catalog: react17 ")).toBe("react17");
  });

  it("returns undefined for ranges that don't use the protocol", () => {
    expect(parseCatalogProtocol("^1.0.0")).toBeUndefined();
    expect(parseCatalogProtocol("workspace:^")).toBeUndefined();
    expect(parseCatalogProtocol("npm:react@^18")).toBeUndefined();
  });
});

describe("resolveCatalogRange", () => {
  it("returns non-catalog ranges unchanged", () => {
    expect(resolveCatalogRange("^1.0.0", "react", catalogs)).toBe("^1.0.0");
    expect(resolveCatalogRange("workspace:^", "react", catalogs)).toBe(
      "workspace:^",
    );
  });

  it("resolves a reference to the default catalog", () => {
    expect(resolveCatalogRange("catalog:", "react", catalogs)).toBe("^18.3.1");
  });

  it("resolves a reference to a named catalog", () => {
    expect(resolveCatalogRange("catalog:react17", "react", catalogs)).toBe(
      "^17.0.2",
    );
  });

  it("returns undefined when the catalog has no entry for the dependency", () => {
    expect(resolveCatalogRange("catalog:", "vue", catalogs)).toBeUndefined();
  });

  it("returns undefined when the catalog doesn't exist", () => {
    expect(
      resolveCatalogRange("catalog:nope", "react", catalogs),
    ).toBeUndefined();
  });

  it("returns undefined when there are no catalogs at all", () => {
    expect(resolveCatalogRange("catalog:", "react", undefined)).toBeUndefined();
  });
});

describe("getChangedCatalogEntries", () => {
  it("reports updated entries", () => {
    expect(
      getChangedCatalogEntries(
        new Map([["default", new Map([["react", "^18.0.0"]])]]),
        new Map([["default", new Map([["react", "^19.0.0"]])]]),
      ),
    ).toStrictEqual([{ catalogName: "default", dependencyName: "react" }]);
  });

  it("reports added and removed entries", () => {
    expect(
      getChangedCatalogEntries(
        new Map([["default", new Map([["react", "^18.0.0"]])]]),
        new Map([["testing", new Map([["jest", "^30.0.0"]])]]),
      ),
    ).toStrictEqual([
      { catalogName: "default", dependencyName: "react" },
      { catalogName: "testing", dependencyName: "jest" },
    ]);
  });

  it("ignores entries that stayed the same", () => {
    const entries = new Map([
      ["default", new Map([["react", "^18.0.0"]])],
      ["testing", new Map([["jest", "^30.0.0"]])],
    ]);
    expect(getChangedCatalogEntries(entries, entries)).toStrictEqual([]);
  });

  it("treats the same dependency in different catalogs separately", () => {
    expect(
      getChangedCatalogEntries(
        new Map([
          ["default", new Map([["react", "^18.0.0"]])],
          ["react17", new Map([["react", "^17.0.2"]])],
        ]),
        new Map([
          ["default", new Map([["react", "^19.0.0"]])],
          ["react17", new Map([["react", "^17.0.2"]])],
        ]),
      ),
    ).toStrictEqual([{ catalogName: "default", dependencyName: "react" }]);
  });
});
