import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // the default is !process.env.CI which makes it hard to debug CI issues at times
    // given we already use vitest/no-focused-tests ESLint rule, it's pretty OK to just allow those at all times to allow CI to run focused tests when debugging issues
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
