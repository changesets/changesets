import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import node from "eslint-plugin-n";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/__fixtures__/**",
      "**/scratchings.js",
      "packages/cli/bin.js",
      "**/*.snap",
    ],
  },
  {
    plugins: { js, node, tseslint, vitest },
    extends: [
      "js/recommended",
      "node/flat/recommended",
      "tseslint/recommended",
      "tseslint/recommendedTypeChecked",
      "vitest/recommended",
    ],
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/await-thenable": "off", // TODO enable and fix errors
      "@typescript-eslint/ban-ts-comment": "off", // TODO enable and fix errors
      "@typescript-eslint/no-empty-object-type": "off", // TODO enable and fix errors
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off", // TODO enable and fix errors
      "@typescript-eslint/no-unnecessary-type-assertion": "off", // TODO enable and fix errors
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": ["off", { caughtErrors: "none" }], // TODO enable and fix errors
      "@typescript-eslint/require-await": "off", // TODO enable and fix errors
      "@typescript-eslint/unbound-method": "off",
      "n/no-extraneous-import": "off",
      "n/no-missing-import": "off",
      "n/no-process-exit": "off",
      "n/no-unpublished-import": "off",
      "n/no-unsupported-features/node-builtins": [
        "error",
        { allowExperimental: true },
      ],
      "prefer-const": "off", // TODO either enable and fix or add comment why not
    },
  },
  {
    files: ["**/*.test.*"],
    rules: {
      "n/no-unsupported-features/node-builtins": [
        "error",
        // TODO: remove when minimum version is >=20.16
        { ignores: ["import.meta.dirname"] },
      ],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  eslintConfigPrettier,
);
