import unicorn from "eslint-plugin-unicorn";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".nuxt/**",
      "packages/*/dist/**",
      "packages/app/.nuxt/**",
      "packages/cli/dist/**",
    ],
  },
  // JavaScript and TypeScript files
  {
    files: ["**/*.js", "**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      unicorn,
      "@typescript-eslint": typescript,
    },
    rules: {
      // Basic rules
      "no-console": "off",
      "no-debugger": "warn",
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "prefer-const": "error",
      "no-useless-constructor": "error",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-non-null-assertion": "off",

      // Async rules
      "require-await": "off",

      // Unicorn rules
      "unicorn/no-null": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-process-exit": "error",
      "unicorn/prefer-ternary": "off",
      "unicorn/prefer-top-level-await": "off",
      "unicorn/prefer-code-point": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prefer-at": "off",
      "unicorn/explicit-length-check": "off",
      "unicorn/prefer-set-has": "off",
      "unicorn/no-empty-file": "error",

      // Other rules
      camelcase: "off",
      "no-empty": [
        "error",
        {
          allowEmptyCatch: true,
        },
      ],
    },
  },
  // Vue files
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        extraFileExtensions: [".vue"],
      },
    },
    plugins: {
      vue,
      "@typescript-eslint": typescript,
      unicorn,
    },
    rules: {
      // Vue rules
      "vue/multi-word-component-names": "off",
      "vue/no-unused-vars": "warn",
      "vue/no-v-html": "off",

      // Basic rules
      "no-console": "off",
      "no-debugger": "warn",
      "prefer-const": "error",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-non-null-assertion": "off",

      // Unicorn rules
      "unicorn/no-null": "off",
      "unicorn/prefer-code-point": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prefer-ternary": "off",
    },
  },
];
