import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    // TODO: enable this and fix tests in packages/cli/src/commands/version/version.test.ts, then remove `vi.resetMocks()` from test files
    // mockReset: true,
  },
});
