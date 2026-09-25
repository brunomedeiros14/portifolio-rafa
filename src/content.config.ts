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
      location: z.string(),
      city: z.string(),
      state: z.string(),
      venue: z.string(),
      description: z.string(),
      excerpt: z.string().max(220),
      cover: image(),
      featured: z.boolean().default(false),
      tags: z.array(z.string()).default([]),
      vendors: z
        .array(
          z.object({
            role: z.string(),
            name: z.string(),
            instagram: z.string().optional(),
          }),
        )
        .default([]),
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