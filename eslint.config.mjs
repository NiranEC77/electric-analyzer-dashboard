import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Flat config shared across all workspace packages. Non-type-aware on
// purpose: fast, and it doesn't re-run the TS type-checker (typecheck
// already covers that). Type correctness is the typecheck step's job.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.astro/**",
      "**/node_modules/**",
      "apps/web/**", // Astro/React app is linted via its own toolchain later
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
