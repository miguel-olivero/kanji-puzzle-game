import { defineConfig } from 'vite';
export default defineConfig({
  base: '/kanji-puzzle-game/',
  server: {
    port: 5173,
  },
  build: {
    target: 'ES2020',
    minify: 'terser',
    sourcemap: false,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
});