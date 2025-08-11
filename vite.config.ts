import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/engine': resolve(__dirname, './src/engine'),
      '@/types': resolve(__dirname, './src/types'),
      '@/cards': resolve(__dirname, './src/cards'),
      '@/ui': resolve(__dirname, './src/ui'),
      '@/bot': resolve(__dirname, './src/bot'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});