import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  base: './', // Use relative paths for file:// URLs
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
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});