import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Module-boundary rule (ADR-W009 / ME-19): the reusable inner layers must never
  // import from the outermost routing layer (`app/`). Server Actions live in
  // route-independent `@/lib/actions/*`; both components and route files import
  // them from there. This makes the one-way dependency self-enforcing and
  // prevents the inverted/near-circular graph the refactor removed.
  {
    files: ["src/components/**", "src/lib/**", "src/hooks/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/app/*", "@/app/**", "**/app/**/actions", "../app/*", "../../app/*"],
          message:
            "Reusable modules must not import from app/. Import Server Actions from @/lib/actions/* instead (ADR-W009).",
        }],
      }],
    },
  },
]);

export default eslintConfig;
