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
      { name: "pkg-a", newVersion: "1.0.0-beta.1", published: true },
    ]);
  });

  it("publishes prerelease-only package to latest when detected via fallback", async () => {
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
        if (args?.[1] === "pkg-a") {
          return spawnResult("");
        }
        if (args?.[1] === "pkg-a@1.0.0-beta.1") {
          return spawnResult(
            JSON.stringify({
              name: "pkg-a",
              version: "1.0.0-beta.1",
              versions: ["1.0.0-beta.0"],
            })
          );
        }
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
      { name: "pkg-a", newVersion: "1.0.0-beta.1", published: true },
    ]);

    const publishCall = mockSpawn.mock.calls.find(
      ([cmd, args]) => cmd === "npm" && args?.[0] === "publish"
    );
    expect(publishCall?.[1]).toEqual(
      expect.arrayContaining(["--tag", "latest"])
    );
  });
});
