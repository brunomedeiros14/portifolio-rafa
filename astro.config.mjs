// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SITE } from './src/site.config.ts';

/**
 * Data de última modificação por URL, extraída do frontmatter das entradas.
 *
 * O sitemap usava `lastmod: new Date()`, avaliado uma vez no boot do build. Isso
 * faz *todo* URL declarar "modificado agora" em cada deploy, para páginas que
 * não mudam há meses. O Google usa esse campo para decidir o que recrawler, e
 * um `lastmod` sempre atual anula o sinal: o site inteiro passa a
 * parecer recém-editado, o que baixa a prioridade dada a páginas realmente
 * novas.
 *
 * Aqui lemos só a primeira linha do arquivo de cada entrada — o suficiente para
 * casar o path com uma data, sem carregar o content layer inteiro no config.
 */
function buildLastmodMap() {
  /** @type {Map<string, Date>} */
  const map = new Map();

  /** @param {string} file @param {string} urlPath */
  const register = (file, urlPath) => {
    const head = readFileSync(file, 'utf8').slice(0, 2000);
    const dateMatch = head.match(/^updated:\s*["']?([\d-]{10})/m) ?? head.match(/^date:\s*["']?([\d-]{10})/m);
    if (!dateMatch) return;
    const date = new Date(`${dateMatch[1]}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return;
    const existing = map.get(urlPath);
    if (!existing || date > existing) map.set(urlPath, date);
  };

  const blogDir = new URL('./src/content/blog/', import.meta.url).pathname;
  for (const file of readdirSync(blogDir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const slug = file.replace(/\.mdx?$/, '');
    register(join(blogDir, file), `/blog/${slug}`);
  }

  const weddingsDir = new URL('./src/content/weddings/', import.meta.url).pathname;
  for (const dir of readdirSync(weddingsDir)) {
    const full = join(weddingsDir, dir, 'index.mdx');
    try {
      statSync(full);
    } catch {
      continue;
    }
    // O slug publicado nem sempre é o nome da pasta: `amanda-e-joao` publica
    // como `amanda-e-joao-fazenda-x`.
    const head = readFileSync(full, 'utf8').slice(0, 2000);
    const slugMatch = head.match(/^slug:\s*["']?([^"'\n]+)/m);
    const slug = slugMatch ? slugMatch[1].trim() : dir;
    register(full, `/casamentos/${slug}`);
  }

  return map;
}

const lastmodByPath = buildLastmodMap();

// Páginas sem data própria não recebem `lastmod`: omitir o campo é honesto,
// enquanto `new Date()` seria uma afirmação falsa de modificação.
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
      // Só páginas públicas navegáveis chegam ao sitemap por padrão. O
      // `/rss.xml` gerado também é um `.xml` e ficaria listado como página.
      filter: (page) =>
        !page.endsWith('/404') && !page.includes('/_astro') && !page.endsWith('.xml'),
      serialize(item) {
        const url = new URL(item.url);
        const date = lastmodByPath.get(url.pathname.replace(/\/$/, ''));
        return { ...item, ...(date ? { lastmod: date.toISOString() } : { lastmod: undefined }) };
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: true,
});
