import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const weddings = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/weddings',
  }),
  schema: ({ image }) =>
    z.object({
      slug: z.string(),
      couple: z.string(),
      date: z.coerce.date(),
      /** Cidade — obrigatória. É o que aparece sozinho nos cards e no slug. */
      city: z.string(),
      /** Sigla do estado: "MG". */
      state: z.string(),
      /**
       * Estabelecimento (fazenda, museu, igreja, hotel). **Opcional**: com ele
       * preenchido a página mostra "Fazenda X, Nova Lima, MG"; vazio, mostra só
       * "Nova Lima, MG". Nos cards nunca aparece.
       */
      venue: z.string().optional(),
      /** Frase de apoio exibida na intro, entre a capa e a galeria. */
      description: z.string(),
      excerpt: z.string().max(220),
      cover: image(),
      featured: z.boolean().default(false),
      /**
       * Rascunho: a página é gerada mas fica `noindex` e fora do sitemap, para
       * revisar antes de o link ser distribuído. Sem isso, publicar no CMS
       * deixava a página pública e indexável no mesmo instante do commit.
       */
      draft: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
    }),
});

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/blog',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string(),
      description: z.string().max(160),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      cover: image().optional(),
      author: z.string().default('Rafael Dias'),
      tags: z.array(z.string()).default([]),
      canonical: z.url().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { weddings, blog };