import { getCorrectRegistry, publish } from "../npm-utils";
import { detect } from "package-manager-detector";
import spawn from "spawndamnit";

// Mock package-manager-detector
jest.mock("package-manager-detector", () => ({
  detect: jest.fn(),
}));

// Mock spawndamnit
jest.mock("spawndamnit", () => jest.fn());

// Mock ci-info
jest.mock("ci-info", () => ({
  isCI: true,
}));

const mockDetect = detect as jest.MockedFunction<typeof detect>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe("npm-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getCorrectRegistry", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return default registry when no config", () => {
      const result = getCorrectRegistry({ name: "test-pkg", version: "1.0.0" });
      expect(result.registry).toBe("https://registry.npmjs.org");
      expect(result.scope).toBeUndefined();
    });

    it("should return scoped registry for scoped packages", () => {
      const result = getCorrectRegistry({
        name: "@scope/test-pkg",
        version: "1.0.0",
        publishConfig: {
          "@scope:registry": "https://custom.registry.com",
        },
      });
      expect(result.registry).toBe("https://custom.registry.com");
      expect(result.scope).toBe("@scope");
    });

    it("should return publishConfig registry", () => {
      const result = getCorrectRegistry({
        name: "test-pkg",
        version: "1.0.0",
        publishConfig: {
          registry: "https://custom.registry.com",
        },
      });
      expect(result.registry).toBe("https://custom.registry.com");
    });

    it("should convert yarnpkg registry to npmjs", () => {
      const result = getCorrectRegistry({
        name: "test-pkg",
        version: "1.0.0",
        publishConfig: {
          registry: "https://registry.yarnpkg.com",
        },
      });
      expect(result.registry).toBe("https://registry.npmjs.org");
    });
  });

  describe("publish", () => {
    const packageJson = { name: "test-pkg", version: "1.0.0" };
    const publishOpts = {
      cwd: "/test/cwd",
      publishDir: "/test/publish-dir",
      access: "public" as const,
      tag: "latest",
    };
    const twoFactorState = {
      token: null,
      isRequired: Promise.resolve(false),
    };

    it("should use bun publish when bun is detected", async () => {
      mockDetect.mockResolvedValue({
        name: "bun",
        agent: "bun@1.0.0",
      });
      mockSpawn.mockResolvedValue({
        code: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      } as any);

      await publish(packageJson, publishOpts, twoFactorState);

      expect(mockSpawn).toHaveBeenCalledWith(
        "bun",
        ["publish", "--access", "public", "--tag", "latest"],
        expect.objectContaining({
          cwd: "/test/publish-dir",
        })
      );
    });

    it("should use pnpm publish when pnpm is detected", async () => {
      mockDetect.mockResolvedValue({
        name: "pnpm",
        agent: "pnpm@8.0.0",
      });
      // Mock pnpm version check
      mockSpawn
        .mockResolvedValueOnce({
          code: 0,
          stdout: Buffer.from("8.0.0"),
          stderr: Buffer.from(""),
        } as any)
        .mockResolvedValueOnce({
          code: 0,
          stdout: Buffer.from(""),
          stderr: Buffer.from(""),
        } as any);

      await publish(packageJson, publishOpts, twoFactorState);

      // First call is version check
      expect(mockSpawn).toHaveBeenNthCalledWith(
        1,
        "pnpm",
        ["--version"],
        expect.any(Object)
      );
      // Second call is publish
      expect(mockSpawn).toHaveBeenNthCalledWith(
        2,
        "pnpm",
        ["publish", "--json", "--access", "public", "--tag", "latest", "--no-git-checks"],
        expect.objectContaining({
          cwd: "/test/cwd",
        })
      );
    });

    it("should use npm publish when npm is detected", async () => {
      mockDetect.mockResolvedValue({
        name: "npm",
        agent: "npm@10.0.0",
      });
      mockSpawn.mockResolvedValue({
        code: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      } as any);

      await publish(packageJson, publishOpts, twoFactorState);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npm",
        ["publish", "/test/publish-dir", "--json", "--access", "public", "--tag", "latest"],
        expect.any(Object)
      );
    });

    it("should use npm publish when yarn is detected (yarn uses npm for publishing)", async () => {
      mockDetect.mockResolvedValue({
        name: "yarn",
        agent: "yarn@1.22.0",
      });
      mockSpawn.mockResolvedValue({
        code: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      } as any);

      await publish(packageJson, publishOpts, twoFactorState);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npm",
        ["publish", "/test/publish-dir", "--json", "--access", "public", "--tag", "latest"],
        expect.any(Object)
      );
    });

    it("should fallback to npm when no package manager is detected", async () => {
      mockDetect.mockResolvedValue(null);
      mockSpawn.mockResolvedValue({
        code: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      } as any);

      await publish(packageJson, publishOpts, twoFactorState);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npm",
        ["publish", "/test/publish-dir", "--json", "--access", "public", "--tag", "latest"],
        expect.any(Object)
      );
    });

    it("should return published: true when publish succeeds", async () => {
      mockDetect.mockResolvedValue({ name: "bun", agent: "bun@1.0.0" });
      mockSpawn.mockResolvedValue({
        code: 0,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
      } as any);

      const result = await publish(packageJson, publishOpts, twoFactorState);

      expect(result.published).toBe(true);
    });

    it("should return published: false when publish fails", async () => {
      mockDetect.mockResolvedValue({ name: "bun", agent: "bun@1.0.0" });
      mockSpawn.mockResolvedValue({
        code: 1,
        stdout: Buffer.from(""),
        stderr: Buffer.from("Error publishing"),
      } as any);

      const result = await publish(packageJson, publishOpts, twoFactorState);

      expect(result.published).toBe(false);
    });
  });
});
