import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': ['warn'],
      'no-debugger': ['warn'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-types': ['error'],
      '@typescript-eslint/no-explicit-any': ['error'],
    },
  },
];