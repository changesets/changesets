import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import node from "eslint-plugin-n";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importLite from "eslint-plugin-import-lite";

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
    plugins: {
      js,
      node,
      tseslint,
      vitest,
    },
    extends: [
      "js/recommended",
      "node/flat/recommended",
      "tseslint/recommended",
      "tseslint/recommendedTypeChecked",
      importLite.configs.recommended,
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
      eqeqeq: ["off", "always", { null: "never", undefined: "never" }], // TODO enable and fix errors
      "prefer-const": "off", // TODO enable and fix errors

      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
      "import-lite/consistent-type-specifier-style": [
        "error",
        "prefer-top-level",
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off", // TODO enable and fix errors
      "@typescript-eslint/no-unnecessary-type-assertion": "off", // TODO enable and fix errors
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off", // TODO enable and fix errors
      "@typescript-eslint/unbound-method": "off",

      // these rules are slow, require extensive config, and/or don't provide much
      "n/no-extraneous-import": "off",
      "n/no-missing-import": "off",
      "n/no-process-exit": "off",
      "n/no-unpublished-import": "off",

      "n/prefer-node-protocol": "off", // TODO enable and fix errors
      "n/no-unsupported-features/node-builtins": [
        "error",
        { ignores: ["fetch", "fs/promises.cp", "import.meta.dirname"] },
      ],

      "import-lite/no-mutable-exports": "off", // TODO enable and fix errors
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  eslintConfigPrettier,
);
