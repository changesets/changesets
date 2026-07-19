import e18e from "@e18e/eslint-plugin";
import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importLite from "eslint-plugin-import-lite";
import node from "eslint-plugin-n";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/*.{json,md}",
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "site/.vitepress",
      "packages/cli/bin.js",
      "site/.vitepress/cache/**",
      "**/*.snap",
    ],
  },
  {
    plugins: {
      e18e,
      js,
      node,
      tseslint,
      vitest,
    },
    extends: [
      "e18e/modernization",
      "e18e/moduleReplacements",
      "e18e/performanceImprovements",
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
      // enforce using `x == null` for nullish checks (no triple equals, no undefined)
      eqeqeq: ["error", "always", { null: "never" }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "BinaryExpression:has(Identifier[name='undefined'])",
          message: "Use `== null` instead of comparing with `undefined`.",
        },
      ],

      "e18e/prefer-static-regex": "off",

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
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/unbound-method": "off",

      // these rules are slow, require extensive config, and/or don't provide much
      "n/no-extraneous-import": "off",
      "n/no-missing-import": "off",
      "n/no-process-exit": "off",
      "n/no-unpublished-import": "off",

      "n/prefer-node-protocol": "error",
      "n/no-unsupported-features/node-builtins": [
        "error",
        { allowExperimental: true },
      ],

      "import-lite/no-default-export": "error",
      "import-lite/no-mutable-exports": "error",
    },
  },
  {
    files: ["site/.vitepress/theme/**"],
    rules: {
      "n/no-unsupported-features/node-builtins": "off",
    },
  },
  {
    files: [
      "**/index.ts", // to be removed in next release (v4) when we are dropping default export
      "**/*config.*", // config files often return default exports
      "site/**/*.data.ts",
      "site/**/*.paths.ts",
    ],
    rules: {
      "import-lite/no-default-export": "off",
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["**/*.test.*"],
    rules: {
      // mock functions often have to be async to match the original fn
      "@typescript-eslint/require-await": "off",
    },
  },
  eslintConfigPrettier,
);
