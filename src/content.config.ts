import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * All content comes from the `szeamer` folder in Obsidian, copied here by
 * `npm run sync` (scripts/obsidian-sync.mjs). Don't edit src/content/vault by
 * hand — the next sync overwrites it.
 */
const VAULT = './src/content/vault';

/** Obsidian leaves empty properties as null; treat those as "not set". */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null || v === '' ? undefined : v), schema.optional());

/** Posts and photo posts share the same properties. */
const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: optional(z.string()),
  draft: z.preprocess((v) => v ?? false, z.boolean()),
});

const blog = defineCollection({
  loader: glob({ base: `${VAULT}/Blog`, pattern: '**/*.md' }),
  schema: postSchema,
});

/** Photo posts: notes in the Photos folder, with photos embedded in the text. */
const photos = defineCollection({
  loader: glob({ base: `${VAULT}/Photos`, pattern: '**/*.md' }),
  schema: postSchema,
});

const projects = defineCollection({
  loader: glob({ base: `${VAULT}/Projects`, pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    link: optional(z.string().url()),
    meta: optional(z.coerce.string()),
    order: optional(z.number()),
    draft: z.preprocess((v) => v ?? false, z.boolean()),
  }),
});

/** Home.md — its properties are site settings, its text is the about blurb. */
const pages = defineCollection({
  loader: glob({ base: VAULT, pattern: 'Home.md' }),
  schema: z.object({}).passthrough(),
});

export const collections = { blog, photos, projects, pages };
