import path from "node:path";
import parser from "@typescript-eslint/parser";

const rootPath = path.resolve(".");

export default [
  {
    ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        globalThis: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
];
