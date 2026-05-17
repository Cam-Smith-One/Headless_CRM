import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // API response shapes throughout the web app use `any` deliberately
      // (dynamic CRM data, fetch responses). Enforce proper types separately.
      "@typescript-eslint/no-explicit-any": "off",
      // Reading localStorage and calling setState in a useEffect is the correct
      // pattern for client-side hydration in Next.js App Router — this rule is
      // overly strict for these cases.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
