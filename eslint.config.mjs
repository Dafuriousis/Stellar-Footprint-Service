import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      "**/dist",
      "**/node_modules",
      "**/build",
      "**/target",
      "contracts/**",
      "scripts/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      prettier,
    },
    rules: {
      // Prettier
      "prettier/prettier": "error",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // General
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  prettierConfig,
];

// Strict no-console rule for src/ (except logger utility)
const srcConfig = {
  files: ["src/**/*.ts", "src/**/*.tsx"],
  rules: {
    "no-console": "error",
  },
};

// Exempt logger utility from no-console rule
const loggerExemption = {
  files: ["src/utils/logger.ts"],
  rules: {
    "no-console": "off",
  },
};

export default [...config, srcConfig, loggerExemption];
