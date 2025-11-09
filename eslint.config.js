import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";

const typescriptConfig = {
  files: ["**/*.ts"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      sourceType: "module",
      ecmaVersion: "latest"
    },
    globals: {
      ...globals.node,
      ...globals.es2024
    }
  },
  plugins: {
    "@typescript-eslint": tsPlugin
  },
  rules: {
    ...tsPlugin.configs.recommended.rules,
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/consistent-type-imports": "error"
  }
};

export default [
  js.configs.recommended,
  typescriptConfig,
  prettierConfig
];
