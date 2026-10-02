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
      title: z.string(),
      slug: z.string(),
      couple: z.string(),
      date: z.coerce.date(),
      /**
       * Cidade **ou** estabelecimento, do jeito que vai ser lido: "Ouro Preto"
       * ou "Fazenda X, Nova Lima". Antes havia `city` e `venue` separados, o
       * que obrigava o autor a escolher um dos dois e ainda repetia o mesmo
       * dado até três vezes na página. `state` continua à parte.
       */
      location: z.string(),
      state: z.string(),
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
      seoTitle: z.string().optional(),
      seoDescription: z.string().max(160).optional(),
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
      description: z.string().max(180),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      cover: image().optional(),
      author: z.string().default('Rafael Dias'),
      tags: z.array(z.string()).default([]),
      canonical: z.url().optional(),
      draft: z.boolean().default(false),
      seoTitle: z.string().optional(),
      seoDescription: z.string().max(160).optional(),
    }),
});

export const collections = { weddings, blog };