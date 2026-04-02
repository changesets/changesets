import publishPackages from "../publishPackages";
import { getPackages } from "@manypkg/get-packages";
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

function mockSpawnImplementation(
  fn: (cmd: string, args: string[]) => ReturnType<typeof spawnResult>
) {
  mockSpawn.mockImplementation(((cmd: string, args: string[]) =>
    Promise.resolve(fn(cmd, args))) as any);
}

describe("publishPackages", () => {
  silenceLogsInBlock();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("does not call out to npm to see if otp is required in CI", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0",
      }),
    });

    mockSpawnImplementation((cmd, args) => {
      if (cmd === "npm" && args?.[0] === "info") {
        return spawnResult("");
      }
      if (cmd === "npm" && args?.[0] === "publish") {
        return spawnResult(JSON.stringify({ id: "pkg-a@1.0.0" }));
      }
      return spawnResult("", 1);
    });

    await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      preState: undefined,
    });

    const spawnCalls = mockSpawn.mock.calls;
    expect(
      spawnCalls.some(
        ([cmd, args]) => cmd === "npm" && args?.includes("profile")
      )
    ).toBe(false);
  });

  it("skips already-published prerelease found via exact version fallback", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.0",
      }),
    });

    mockSpawnImplementation((cmd, args) => {
      if (cmd === "npm" && args?.[0] === "info") {
        if (args?.[1] === "pkg-a") {
          return spawnResult("");
        }
        if (args?.[1] === "pkg-a@1.0.0-beta.0") {
          return spawnResult(
            JSON.stringify({
              name: "pkg-a",
              version: "1.0.0-beta.0",
              versions: ["1.0.0-beta.0"],
            })
          );
        }
      }
      return spawnResult("", 1);
    });

    const result = await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      preState: undefined,
    });

    expect(result).toEqual([]);
    expect(
      mockSpawn.mock.calls.some(
        ([cmd, args]) => cmd === "npm" && args?.[0] === "publish"
      )
    ).toBe(false);
  });

  it("publishes a new prerelease when exact version fallback also 404s", async () => {
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.1",
      }),
    });

    mockSpawnImplementation((cmd, args) => {
      if (cmd === "npm" && args?.[0] === "info") {
        return spawnResult("");
      }
      if (cmd === "npm" && args?.[0] === "publish") {
        return spawnResult(JSON.stringify({ id: "pkg-a@1.0.0-beta.1" }));
      }
      return spawnResult("", 1);
    });

    const result = await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      preState: undefined,
    });

    expect(result).toEqual([
      { name: "pkg-a", newVersion: "1.0.0-beta.1", result: "published" },
    ]);
  });

  it("detects only-pre via bare query and publishes to latest", async () => {
    // npmjs.org auto-assigns dist-tags.latest to the first publish, so the bare
    // query returns the full versions array. If every version is a prerelease
    // under the same tag, the next version is published to "latest" instead.
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.1",
      }),
    });

    mockSpawnImplementation((cmd, args) => {
      if (cmd === "npm" && args?.[0] === "info" && args?.[1] === "pkg-a") {
        return spawnResult(
          JSON.stringify({
            name: "pkg-a",
            version: "1.0.0-beta.0",
            versions: ["1.0.0-beta.0"],
          })
        );
      }
      if (cmd === "npm" && args?.[0] === "publish") {
        return spawnResult(JSON.stringify({ id: "pkg-a@1.0.0-beta.1" }));
      }
      return spawnResult("", 1);
    });

    const result = await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      preState: {
        mode: "pre",
        tag: "beta",
        initialVersions: {},
        changesets: [],
      },
    });

    expect(result).toEqual([
      { name: "pkg-a", newVersion: "1.0.0-beta.1", result: "published" },
    ]);

    const publishCall = mockSpawn.mock.calls.find(
      ([cmd, args]) => cmd === "npm" && args?.[0] === "publish"
    );
    expect(publishCall?.[1]).toEqual(
      expect.arrayContaining(["--tag", "latest"])
    );
  });

  it("publishes with specified tag on GitHub Packages when new version not yet published", async () => {
    // GitHub Packages does not auto-assign latest on first publish. When both
    // the bare query and the exact-version fallback return empty, there is no
    // versions list to detect only-pre, so the package is tagged with
    // preState.tag rather than "latest".
    const cwd = await testdir({
      "package.json": JSON.stringify({
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/pkg-a/package.json": JSON.stringify({
        name: "pkg-a",
        version: "1.0.0-beta.1",
      }),
    });

    mockSpawnImplementation((cmd, args) => {
      if (cmd === "npm" && args?.[0] === "info") {
        return spawnResult("");
      }
      if (cmd === "npm" && args?.[0] === "publish") {
        return spawnResult(JSON.stringify({ id: "pkg-a@1.0.0-beta.1" }));
      }
      return spawnResult("", 1);
    });

    const result = await publishPackages({
      packages: (await getPackages(cwd)).packages,
      access: "public",
      preState: {
        mode: "pre",
        tag: "beta",
        initialVersions: {},
        changesets: [],
      },
    });

    expect(result).toEqual([
      { name: "pkg-a", newVersion: "1.0.0-beta.1", result: "published" },
    ]);

    const publishCall = mockSpawn.mock.calls.find(
      ([cmd, args]) => cmd === "npm" && args?.[0] === "publish"
    );
    expect(publishCall?.[1]).toEqual(expect.arrayContaining(["--tag", "beta"]));
    expect(publishCall?.[1]).not.toContain("latest");
  });
});
