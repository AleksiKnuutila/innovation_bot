import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'vb-implementation/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
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
});