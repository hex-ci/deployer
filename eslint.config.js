import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,jsx,ts,tsx,cjs,mjs}'],
  },

  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/.playwright-cli/**',
    '**/*.yml',
    '**/*.yaml',
  ]),

  js.configs.recommended,
  stylistic.configs.recommended,

  {
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.node,
        NodeListOf: 'readonly',
      },
    },
    rules: {
    },
  },
])
