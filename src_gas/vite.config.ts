import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { gasDeploy } from './vite-gas.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: ROOT,
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: path.join(ROOT, 'src/ui/routes'),
      generatedRouteTree: path.join(ROOT, 'src/ui/routeTree.gen.ts'),
      quoteStyle: 'single',
      semicolons: false,
    }),
    react(),
    tailwindcss(),
    viteSingleFile(),
    gasDeploy(),
  ],
  resolve: {
    alias: {
      '@site': path.join(ROOT, '../src'),
    },
  },
  build: {
    outDir: path.join(ROOT, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: true,
    rollupOptions: {
      input: path.join(ROOT, 'src/ui/index.html'),
      // o bundle inline precisa ser IIFE (auditoria §11): começa em
      // `(function () {` e termina em `})();`, sem import/export de topo.
      output: {
        format: 'iife',
        name: 'CMS',
      },
    },
  },
});
