import { getCorrectRegistry, isCustomRegistry } from "../npm-utils";

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getCorrectRegistry", () => {
  it("falls back to the npm registry when no registry is configured", () => {
    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org/");
  });

  it("maps the yarn registry to the npm registry", () => {
    process.env.npm_config_registry = "https://registry.yarnpkg.com";

    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org/");
  });

  it("adds a trailing slash to path-based registries from npm config", () => {
    process.env.npm_config_registry = "https://nexus.example.com/npm";

    expect(getCorrectRegistry().registry).toBe(
      "https://nexus.example.com/npm/"
    );
  });

  it("adds a trailing slash to scoped registries from npm config", () => {
    process.env["npm_config_@acme:registry"] = "https://nexus.example.com/npm";

    expect(
      getCorrectRegistry({ name: "@acme/pkg", version: "1.0.0" }).registry
    ).toBe("https://nexus.example.com/npm/");
  });

  it("prefers the scoped registry over the default registry", () => {
    process.env.npm_config_registry = "https://registry.example.com/default";
    process.env["npm_config_@acme:registry"] = "https://registry.example.com/acme";

    expect(
      getCorrectRegistry({ name: "@acme/pkg", version: "1.0.0" })
    ).toEqual({
      scope: "@acme",
      registry: "https://registry.example.com/acme/",
    });
  });

  it("uses publishConfig.registry when provided", () => {
    expect(
      getCorrectRegistry({
        name: "pkg",
        version: "1.0.0",
        publishConfig: { registry: "https://registry.example.com/npm" },
      }).registry
    ).toBe("https://registry.example.com/npm/");
  });

  it("uses publishConfig scoped registry when provided", () => {
    expect(
      getCorrectRegistry({
        name: "@acme/pkg",
        version: "1.0.0",
        publishConfig: {
          "@acme:registry": "https://registry.example.com/acme",
        },
      })
    ).toEqual({
      scope: "@acme",
      registry: "https://registry.example.com/acme/",
    });
  });

  it("leaves already-normalized URLs unchanged", () => {
    process.env.npm_config_registry = "https://nexus.example.com/npm/";

    expect(getCorrectRegistry().registry).toBe("https://nexus.example.com/npm/");
  });

  it("normalizes the pathname while preserving query params and hashes", () => {
    process.env.npm_config_registry =
      "https://nexus.example.com/npm?token=abc#fragment";

    expect(getCorrectRegistry().registry).toBe(
      "https://nexus.example.com/npm/?token=abc#fragment"
    );
  });
});

describe("isCustomRegistry", () => {
  it("returns false for an undefined registry", () => {
    expect(isCustomRegistry(undefined)).toBe(false);
  });

  it("treats npm and yarn default registries as non-custom after normalization", () => {
    expect(isCustomRegistry("https://registry.npmjs.org")).toBe(false);
    expect(isCustomRegistry("https://registry.yarnpkg.com")).toBe(false);
  });

  it("treats already-normalized default registries as non-custom", () => {
    expect(isCustomRegistry("https://registry.npmjs.org/")).toBe(false);
    expect(isCustomRegistry("https://registry.yarnpkg.com/")).toBe(false);
  });

  it("returns true for a custom root registry", () => {
    expect(isCustomRegistry("https://registry.example.com")).toBe(true);
  });

  it("returns true for a path-based custom registry", () => {
    expect(isCustomRegistry("https://registry.example.com/npm")).toBe(true);
  });
});
