import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    // TODO: migrate away from global
    globals: true,
  },
});
