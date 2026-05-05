import path from "node:path";
import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

const rootPath = path.resolve(".");

export default [
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/dist-electron/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/__tests__/**",
      "**/*.tsbuildinfo",
      "vendor/**",
      "examples/**",
      "force_sync.ts",
      "apps/server/**",
      "apps/desktop/src/iconManager.ts",
      "apps/desktop/src/statusBar.ts",
      "apps/desktop/src/protocol.ts",
      "apps/desktop/src/native/notifications.ts",
      "apps/desktop/src/ipc/categoryHandlers.ts",
      "packages/ui/src/components/ba/**",
      "packages/ui/src/components/drift/**",
      "packages/ui/src/components/config/BAConfigView.tsx",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["**/__tests__/**/*.test.ts"],
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
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
      ...reactHooks.configs["recommended-latest"].rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
            properties: false,
          },
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      "unused-imports": unusedImports,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
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
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["scripts/**", "apps/mcp-server/**"],
    rules: {
      "no-console": "off",
    },
  },
  // ─── Design System Enforcement ────────────────────────────────────────────
  // Prevent raw HTML elements and hardcoded Tailwind colors in app code.
  // Design system components (packages/) are excluded — they legitimately use raw HTML.
  {
    files: ["apps/**/*.{tsx}"],
    ignores: ["apps/web/app/design-system/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Use <Button> from @kletron/ui instead of raw <button>.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: "Use <Input> or <PasswordInput> from @kletron/ui instead of raw <input>.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use <Selector> from @kletron/ui instead of raw <select>.",
        },
        {
          selector: "Literal[value=/(?:^|\\s)(?:bg|text|border|ring|from|via|to|divide|placeholder|decoration)-(?:red|green|blue|amber|emerald|rose|orange|yellow|purple|pink|teal|cyan|lime|indigo|violet|fuchsia|sky)-\\d/]",
          message: "Use semantic design tokens (e.g., status-success-text, status-error-bg) instead of raw Tailwind color classes.",
        },
      ],
    },
  },
];
