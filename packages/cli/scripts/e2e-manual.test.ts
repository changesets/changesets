import fs from "node:fs/promises";
import path from "node:path";
import { testdir } from "@changesets/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthProxy,
  pmCases,
  writePmBins,
  type RegistryRequestRecord,
} from "../src/commands/__tests__/e2e-utils.ts";
import {
  createManualAuthConfig,
  createManualProjectFixture,
  createPublishDelayMiddleware,
  MANUAL_OTP_CODE,
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

  it("requires the documented OTP for every fixture package", () => {
    const requirements = createManualAuthConfig("manual-token").packages!;

    expect(Object.keys(requirements)).toHaveLength(9);
    expect(
      Object.values(requirements).every(
        (requirement) =>
          requirement.token === "manual-token" &&
          requirement.otp?.code === MANUAL_OTP_CODE &&
          requirement.otp.allowMissingAfterSuccess === false,
      ),
    ).toBe(true);
    expect(MANUAL_OTP_CODE).toBe("123321");
  });

  it("can allow missing OTPs after one successful verification", () => {
    const requirements = createManualAuthConfig(
      "manual-token",
      "once",
    ).packages!;

    expect(
      Object.values(requirements).every(
        (requirement) => requirement.otp?.allowMissingAfterSuccess === true,
      ),
    ).toBe(true);
  });

  it("accepts a missing OTP only after one valid OTP", async () => {
    await using proxy = await createAuthProxy(
      "http://registry.invalid",
      "upstream-token",
      {
        auth: createManualAuthConfig("manual-token", "once"),
        middleware: async () => new Response(null, { status: 201 }),
      },
    );
    const publish = (otpCode?: string) =>
      fetch(new URL("/pkg-a", proxy.url), {
        headers: {
          authorization: "Bearer manual-token",
          ...(otpCode && { "npm-otp": otpCode }),
        },
        method: "PUT",
      });

    const missingBeforeVerification = await publish();
    expect(missingBeforeVerification.status).toBe(401);
    expect(missingBeforeVerification.headers.get("www-authenticate")).toBe(
      "OTP",
    );
    await expect(publish(MANUAL_OTP_CODE)).resolves.toHaveProperty(
      "status",
      201,
    );
    await expect(publish()).resolves.toHaveProperty("status", 201);
    await expect(publish("000000")).resolves.toHaveProperty("status", 401);
  });

  it("can require a second OTP for pkg-e without blocking its chunk", async () => {
    const auth = createManualAuthConfig("manual-token", "twice");
    expect(auth.packages?.["pkg-e"].otp?.requiredVerificationCount).toBe(2);
    expect(auth.packages?.["pkg-d"].otp?.requiredVerificationCount).toBe(
      undefined,
    );

    await using proxy = await createAuthProxy(
      "http://registry.invalid",
      "upstream-token",
      {
        auth,
        middleware: async () => new Response(null, { status: 201 }),
      },
    );
    const publish = (packageName: string, otpCode?: string) =>
      fetch(new URL(`/${packageName}`, proxy.url), {
        headers: {
          authorization: "Bearer manual-token",
          ...(otpCode && { "npm-otp": otpCode }),
        },
        method: "PUT",
      });

    await expect(publish("pkg-a")).resolves.toHaveProperty("status", 401);
    await expect(publish("pkg-a", MANUAL_OTP_CODE)).resolves.toHaveProperty(
      "status",
      201,
    );
    await expect(publish("pkg-b")).resolves.toHaveProperty("status", 201);
    await expect(publish("pkg-e")).resolves.toHaveProperty("status", 401);
    await expect(publish("pkg-d")).resolves.toHaveProperty("status", 201);
    await expect(publish("pkg-e", MANUAL_OTP_CODE)).resolves.toHaveProperty(
      "status",
      201,
    );
    await expect(publish("pkg-e")).resolves.toHaveProperty("status", 201);
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
