// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import { SITE } from './src/site.config.ts';

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    mdx({
      optimize: true,
      gfm: true,
    }),
    sitemap({
      changefreq: 'weekly',
      lastmod: new Date(),
      // Só páginas públicas navegáveis chegam ao sitemap por padrão.
      filter: (page) =>
        !page.endsWith('/404') && !page.includes('/_astro'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: true,
});