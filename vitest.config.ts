import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // TODO: migrate away from global
    globals: true,
  },
});
