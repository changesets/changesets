import { testdir } from "@changesets/test-utils";
import { describe, expect, it } from "vitest";
import { readConfig } from "./parse.ts";

async function readWorkspaceConfig(config: Record<string, unknown>) {
  const cwd = await testdir({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["packages/*"],
    }),
    "package-lock.json": "",
    "packages/a/package.json": JSON.stringify({
      name: "@pkg/a",
      version: "1.0.0",
    }),
    "packages/b/package.json": JSON.stringify({
      name: "@pkg/b",
      version: "1.0.0",
    }),
    ".changeset/config.json": JSON.stringify(config),
  });
  return readConfig(cwd);
}

describe("include config", () => {
  it("does not exclude packages when include is absent", async () => {
    const result = await readWorkspaceConfig({});
    expect(result.errors).toBeUndefined();
    expect(result.config?.ignore).toEqual([]);
  });

  it.each([
    { include: ["@pkg/a"], ignore: ["@pkg/b"] },
    { include: ["@pkg/*", "!@pkg/b"], ignore: ["@pkg/b"] },
    { include: ["@pkg/a", "@pkg/b"], ignore: [] },
    { include: [], ignore: ["@pkg/a", "@pkg/b"] },
    { include: ["missing-*"], ignore: ["@pkg/a", "@pkg/b"] },
  ])(
    "normalizes $include to the ignore complement",
    async ({ include, ignore }) => {
      const result = await readWorkspaceConfig({ include });
      expect(result.errors).toBeUndefined();
      expect(result.config?.ignore).toEqual(ignore);
    },
  );

  it.each(["@pkg/a", null, [1]])(
    "rejects invalid include value %j",
    async (include) => {
      const result = await readWorkspaceConfig({ include });
      expect(result.config).toBeUndefined();
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringMatching(/^include(?:\.0)?:/)]),
      );
    },
  );

  it("rejects include combined with nonempty ignore patterns", async () => {
    const result = await readWorkspaceConfig({
      include: ["@pkg/a"],
      ignore: ["missing-*"],
    });
    expect(result.config).toBeUndefined();
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("include")]),
    );
  });

  it("allows include with the default empty ignore list", async () => {
    const result = await readWorkspaceConfig({
      include: ["@pkg/a"],
      ignore: [],
    });
    expect(result.errors).toBeUndefined();
    expect(result.config?.ignore).toEqual(["@pkg/b"]);
  });
});
