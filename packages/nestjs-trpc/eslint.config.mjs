// @ts-check
import eslint from '@eslint/js'
import prettierConfig from 'eslint-plugin-prettier/recommended'
import globals from 'globals'
import * as tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: [
            'eslint.config.mjs',
            'release.config.mjs',
            'src/trpc/@generated/server.ts',
            'dist/**',
            'node_modules/**',
            'pnpm-lock.yaml',
            'scripts/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    prettierConfig,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            ecmaVersion: 5,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    }
)
