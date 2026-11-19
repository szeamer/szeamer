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

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../content/vault/{Photos,attachments}/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG}',
  { eager: true },
);

/** The first photo in a post, for its tile on /photos. */
export function coverImage(post: PhotoPost): ImageMetadata | undefined {
  const m = post.body?.match(/!\[[^\]]*\]\(<?([^)>]+)>?\)/);
  if (!m || !post.filePath) return undefined;
  const parts = post.filePath.replace(/^.*?src\/content\/vault\//, '').split('/').slice(0, -1);
  for (const seg of decodeURI(m[1]).split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg) parts.push(seg);
  }
  return images[`../content/vault/${parts.join('/')}`]?.default;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
