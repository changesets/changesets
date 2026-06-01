import {
  getCorrectRegistry,
  isCustomRegistry,
  getPackageInfo,
} from "../npm-utils";
import { silenceLogsInBlock, testdir } from "@changesets/test-utils";
import spawn from "spawndamnit";

jest.mock("spawndamnit");

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function spawnResult(stdout: string, code = 0) {
  return {
    code,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(""),
  };
}

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("getCorrectRegistry", () => {
  it("falls back to the npm registry when no registry is configured", () => {
    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org");
  });

  it("maps the yarn registry to the npm registry", () => {
    process.env.npm_config_registry = "https://registry.yarnpkg.com";

    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org");
  });

  it("maps the slash-suffixed npm registry to the canonical npm registry", () => {
    process.env.npm_config_registry = "https://registry.npmjs.org/";

    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org");
  });

  it("preserves path-based registries from npm config", () => {
    process.env.npm_config_registry = "https://nexus.example.com/npm";

    expect(getCorrectRegistry().registry).toBe("https://nexus.example.com/npm");
  });

  it("preserves scoped registries from npm config", () => {
    process.env["npm_config_@acme:registry"] = "https://nexus.example.com/npm";

    expect(
      getCorrectRegistry({ name: "@acme/pkg", version: "1.0.0" }).registry
    ).toBe("https://nexus.example.com/npm");
  });

  it("prefers the scoped registry over the default registry", () => {
    process.env.npm_config_registry = "https://registry.example.com/default";
    process.env["npm_config_@acme:registry"] =
      "https://registry.example.com/acme";

    expect(getCorrectRegistry({ name: "@acme/pkg", version: "1.0.0" })).toEqual(
      {
        scope: "@acme",
        registry: "https://registry.example.com/acme",
      }
    );
  });

  it("uses publishConfig.registry when provided", () => {
    expect(
      getCorrectRegistry({
        name: "pkg",
        version: "1.0.0",
        publishConfig: { registry: "https://registry.example.com/npm" },
      }).registry
    ).toBe("https://registry.example.com/npm");
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
      registry: "https://registry.example.com/acme",
    });
  });

  it("preserves registry URLs that already end with a slash", () => {
    process.env.npm_config_registry = "https://nexus.example.com/npm/";

    expect(getCorrectRegistry().registry).toBe(
      "https://nexus.example.com/npm/"
    );
  });

  it("preserves query params and hashes exactly", () => {
    process.env.npm_config_registry =
      "https://nexus.example.com/npm?token=abc#fragment";

    expect(getCorrectRegistry().registry).toBe(
      "https://nexus.example.com/npm?token=abc#fragment"
    );
  });

  it("maps the slash-suffixed yarn registry to the npm registry", () => {
    process.env.npm_config_registry = "https://registry.yarnpkg.com/";

    expect(getCorrectRegistry().registry).toBe("https://registry.npmjs.org");
  });
});

describe("isCustomRegistry", () => {
  it("returns false for an undefined registry", () => {
    expect(isCustomRegistry(undefined)).toBe(false);
  });

  it("treats npm and yarn default registries as non-custom", () => {
    expect(isCustomRegistry("https://registry.npmjs.org")).toBe(false);
    expect(isCustomRegistry("https://registry.yarnpkg.com")).toBe(false);
  });

  it("treats slash-suffixed default registries as non-custom", () => {
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

describe("getPackageInfo", () => {
  silenceLogsInBlock();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses pnpm info when packageManager field specifies pnpm", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        packageManager: "pnpm@9.0.0",
      }),
    });

    mockSpawn.mockImplementation(((cmd: string, args: string[]) =>
      Promise.resolve(
        cmd === "pnpm" && args?.[0] === "info"
          ? spawnResult(
              JSON.stringify({
                name: "pkg-a",
                version: "1.0.0",
                versions: ["1.0.0"],
              })
            )
          : spawnResult("", 1)
      )) as any);

    const result = await getPackageInfo(
      { name: "pkg-a", version: "1.0.0" },
      cwd
    );

    expect(result).toMatchObject({ name: "pkg-a" });
    expect(
      mockSpawn.mock.calls.some(
        ([cmd, args]) => cmd === "npm" && args?.[0] === "info"
      )
    ).toBe(false);
    expect(
      mockSpawn.mock.calls.some(
        ([cmd, args]) => cmd === "pnpm" && args?.[0] === "info"
      )
    ).toBe(true);
  });

  it("treats yarn classic error JSON as not found and returns E404 when both queries fail", async () => {
    // yarn v1 returns {"type":"error","data":"..."} (non-empty) instead of empty stdout
    // when a package or version isn't found. Without the fix, the empty-stdout guard never
    // fires, the error object bypasses E404 normalization, and the package appears published.
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        packageManager: "yarn@1.22.0",
      }),
    });

    mockSpawn.mockImplementation(((cmd: string, args: string[]) =>
      Promise.resolve(
        cmd === "yarn" && args?.[0] === "info"
          ? spawnResult(
              JSON.stringify({
                type: "error",
                data: 'error Couldn\'t find package "pkg-a" on the "npm" registry.',
              })
            )
          : spawnResult("", 1)
      )) as any);

    const result = await getPackageInfo(
      { name: "pkg-a", version: "1.0.0" },
      cwd
    );

    expect(result).toEqual({ error: { code: "E404" } });
    expect(
      mockSpawn.mock.calls.some(
        ([cmd, args]) => cmd === "npm" && args?.[0] === "info"
      )
    ).toBe(false);
    expect(
      mockSpawn.mock.calls.some(
        ([cmd, args]) => cmd === "yarn" && args?.[0] === "info"
      )
    ).toBe(true);
  });

  it("strips the yarn classic inspect wrapper from a successful response", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        packageManager: "yarn@1.22.0",
      }),
    });

    const packageData = {
      name: "pkg-a",
      version: "1.0.0",
      versions: ["1.0.0"],
    };

    mockSpawn.mockImplementation(((cmd: string, args: string[]) =>
      Promise.resolve(
        cmd === "yarn" && args?.[0] === "info"
          ? spawnResult(JSON.stringify({ type: "inspect", data: packageData }))
          : spawnResult("", 1)
      )) as any);

    const result = await getPackageInfo(
      { name: "pkg-a", version: "1.0.0" },
      cwd
    );

    expect(result).toEqual(packageData);
  });
});
