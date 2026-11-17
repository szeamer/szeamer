import { getCollection, type CollectionEntry } from 'astro:content';
import { shown } from '../data/site';

export type Post = CollectionEntry<'blog'>;

/** All published posts, newest first. Drafts are hidden outside of `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  if (!shown.has('writing')) return [];
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
