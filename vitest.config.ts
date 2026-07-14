import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    allowOnly: true,
    experimental: { preParse: true },
    clearMocks: true,
    restoreMocks: true,
    // TODO: enable this and fix tests in packages/cli/src/commands/version/version.test.ts, then remove `vi.resetMocks()` from test files
    // mockReset: true,

    tags: [
      {
        name: "slow",
        description:
          "Slow tests, like ones that require lots of git operations",
        timeout: 10_000,
      },
    ],
  },
});
