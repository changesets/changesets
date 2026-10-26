import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: true,
    experimental: { preParse: true },
    clearMocks: true,
    restoreMocks: true,
    testTimeout: process.platform === "win32" ? 30_000 : 10_000,
  },
});
