/**
 * ESLint flat config for Next.js 16 + ESLint 9.
 * Uses Next core web vitals + TypeScript rules and ignores non-Next runtimes.
 */

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Keep lint signal but avoid blocking CI on strict React Compiler-style checks.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  globalIgnores([
    'supabase/functions/**',
    'supabase/.temp/**',
    '.next/**',
    '.worktrees/**',
    '.claude/worktrees/**',
    'out/**',
    'build/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
]);
