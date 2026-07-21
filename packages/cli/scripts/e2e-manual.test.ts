import fs from "node:fs/promises";
import path from "node:path";
import { testdir } from "@changesets/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  pmCases,
  writePmBins,
  type RegistryRequestRecord,
} from "../src/commands/__tests__/e2e-utils.ts";
import {
  createManualProjectFixture,
  createPublishDelayMiddleware,
  MANUAL_PUBLISH_DELAY_MS,
} from "./e2e-manual.ts";

function createRecord(method: string, pathname: string): RegistryRequestRecord {
  return {
    headers: {},
    method,
    pathname,
  };
}

describe("manual publish e2e", () => {
  it.each(pmCases)("configures $name for the pnpr proxy", async (pm) => {
    const registry = {
      authToken: "manual-token",
      host: "127.0.0.1:4873",
      url: "http://127.0.0.1:4873/",
    };
    const fixture = await createManualProjectFixture(pm, {
      pmBinPath: path.join("manual", "bin"),
      registry,
    });
    const config = String(
      fixture[pm.command === "yarn" ? ".yarnrc.yml" : ".npmrc"],
    );
    const workspaceConfig = fixture["pnpm-workspace.yaml"];
    const packageJson = JSON.parse(String(fixture["package.json"]));

    expect(config).toContain(registry.url);
    expect(config).toContain(registry.authToken);
    expect(
      typeof workspaceConfig === "string" &&
        workspaceConfig.includes("verifyDepsBeforeRun: false"),
    ).toBe(pm.id === "pnpm-11");
    expect(packageJson.scripts.changeset).toContain(".manual/changeset.mjs");
    expect(packageJson.scripts.pnpr).toContain(".manual/pnpr.mjs");
    expect(String(fixture[".manual/changeset.mjs"])).toContain(
      path.join("manual", "bin"),
    );
  });

  it("writes package-manager shims from the selected e2e case", async () => {
    const cwd = await testdir();
    const npmCase = pmCases.find((pm) => pm.id === "npm-10")!;
    await writePmBins(cwd, npmCase.bins);
    const shim = await fs.readFile(
      path.join(cwd, process.platform === "win32" ? "npm.cmd" : "npm"),
      "utf8",
    );

    expect(shim).toContain("npm-10");
  });

  it("delays package PUTs but not reads or registry endpoints", async () => {
    const wait = vi.fn(async () => {});
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const middleware = createPublishDelayMiddleware({ wait });
    const run = (record: RegistryRequestRecord) =>
      middleware({
        pnpr: { fetch, seedPackage: vi.fn() },
        record,
        request: new Request(`http://registry.test${record.pathname}`, {
          method: record.method,
        }),
      });

    await run(createRecord("GET", "/pkg-a"));
    await run(createRecord("PUT", "/-/user/org.couchdb.user:test"));
    await run(createRecord("PUT", "/pkg-a"));

    expect(wait).toHaveBeenCalledExactlyOnceWith(MANUAL_PUBLISH_DELAY_MS);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
