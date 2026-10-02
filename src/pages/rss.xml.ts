import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { SITE, absolute } from '../site.config';

/**
 * Feed RSS do blog.
 *
 * Escrito à mão em vez de usar o pacote `@astrojs/rss` para não adicionar uma
 * dependência por um arquivo de 30 linhas — `sharp` e o resto do pipeline já
 * cobrem o build, e o formato é estável.
 *
 * O escape é obrigatório: título e descrição vêm de arquivos MDX escritos à
 * mão, e um `&` ou `<` sem escapar torna o documento inválido — leitores
 * estritos simplesmente rejeitam o feed inteiro.
 */
const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );

  const channelTitle = `Blog de casamento — ${SITE.name}`;
  const channelDescription =
    'Artigos sobre casamento em Minas Gerais: locais, luz, ensaios pré-wedding e como escolher o fotógrafo.';

  const items = posts
    .map((post) => {
      const url = absolute(`/blog/${post.data.slug}`);
      const category = post.data.tags[0];

      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <description>${escapeXml(post.data.description)}</description>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${post.data.date.toUTCString()}</pubDate>${category ? `\n      <category>${escapeXml(category)}</category>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <description>${escapeXml(channelDescription)}</description>
    <link>${absolute('/blog')}</link>
    <atom:link href="${absolute('/rss.xml')}" rel="self" type="application/rss+xml" />
    <language>${SITE.language}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Astro</generator>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
};
