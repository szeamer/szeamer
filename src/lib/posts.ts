import { getCollection, type CollectionEntry } from 'astro:content';
import { shown } from '../data/site';

export type Post = CollectionEntry<'blog'>;
export type PhotoPost = CollectionEntry<'photos'>;

const newestFirst = <T extends { data: { date: Date } }>(a: T, b: T) =>
  b.data.date.valueOf() - a.data.date.valueOf();

/** All published posts, newest first. Drafts are hidden outside of `astro dev`. */
export async function getPosts(): Promise<Post[]> {
  if (!shown.has('writing')) return [];
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort(newestFirst);
}

/** All published photo posts, newest first. Drafts are hidden outside of `astro dev`. */
export async function getPhotoPosts(): Promise<PhotoPost[]> {
  if (!shown.has('photos')) return [];
  const posts = await getCollection('photos', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort(newestFirst);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
