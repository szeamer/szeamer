import type { APIRoute } from 'astro';
import { site } from '../data/site';
import { getPosts } from '../lib/posts';

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ site: baseUrl }) => {
  const base = baseUrl?.href.replace(/\/$/, '') ?? '';
  const posts = (await getPosts()).filter((post) => !post.data.draft);

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escape(post.data.title)}</title>
      <link>${base}/blog/${post.id}/</link>
      <guid>${base}/blog/${post.id}/</guid>
      <pubDate>${post.data.date.toUTCString()}</pubDate>${
        post.data.description ? `\n      <description>${escape(post.data.description)}</description>` : ''
      }
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escape(site.title)}</title>
    <link>${base}/</link>
    <description>${escape(site.description)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
