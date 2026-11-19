import type { PhotoPost } from './posts';

/**
 * Turns a photo post (a note in the Photos folder) into slides.
 *
 * Each embedded photo is a slide; the lines directly under it are its caption.
 * Any other paragraph becomes a text slide, in the same order as in the note.
 */
export type Slide =
  | { kind: 'photo'; src: ImageMetadata; caption: string; info: string }
  | { kind: 'text'; html: string };

type PhotoInfo = {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  exposure?: number;
  iso?: number;
  taken?: string;
};

/** Camera details read from the originals by the sync (scripts/obsidian-sync.mjs). */
const photoInfo: Record<string, PhotoInfo> =
  Object.values(
    import.meta.glob<Record<string, PhotoInfo>>('../content/vault/photo-info.json', {
      eager: true,
      import: 'default',
    }),
  )[0] ?? {};

/** "Nikon D700 · 160mm · f/5.6 · 1/1000s · ISO 320 · 30 Aug 2026" (the lens name is kept in photo-info.json) */
function formatInfo(i: PhotoInfo | undefined): string {
  if (!i) return '';
  const lens = i.focalLength ? `${Math.round(i.focalLength)}mm` : i.lens;
  const shutter = !i.exposure
    ? ''
    : i.exposure >= 1
      ? `${Number(i.exposure.toFixed(1))}s`
      : `1/${Math.round(1 / i.exposure)}s`;
  const taken = i.taken
    ? new Date(`${i.taken}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';
  return [i.camera, lens, i.aperture && `f/${i.aperture}`, shutter, i.iso && `ISO ${i.iso}`, taken]
    .filter(Boolean)
    .join(' · ');
}

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../content/vault/{Photos,attachments}/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG}',
  { eager: true },
);

/** An embedded image, wherever it is in a line ("…caption![](<photo.jpg>)" happens when pasting). */
const IMAGE = /!\[([^\]]*)\]\(<?([^)>]+)>?\)/;
const IMAGE_SPLIT = /(!\[[^\]]*\]\(<?[^)>]+>?\))/;

/** Resolves an image path written relative to the post's own file. */
function resolve(post: PhotoPost, target: string): { src: ImageMetadata; key: string } | undefined {
  const parts = (post.filePath ?? '').replace(/^.*?src\/content\/vault\//, '').split('/').slice(0, -1);
  for (const seg of decodeURI(target).split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg) parts.push(seg);
  }
  const key = parts.join('/');
  const src = images[`../content/vault/${key}`]?.default;
  return src && { src, key };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Just enough markdown for a caption or a short paragraph: links, bold, italics, code. */
export function inline(text: string): string {
  return escape(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href.replace(/"/g, '&quot;')}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])[*_]([^*_]+)[*_](?=[^*\w]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function slidesFor(post: PhotoPost): Slide[] {
  const slides: Slide[] = [];
  for (const block of (post.body ?? '').split(/\r?\n\s*\r?\n/)) {
    let text: string[] = [];
    let photo: { src: ImageMetadata; key: string; caption: string[]; alt: string } | null = null;
    const flush = () => {
      if (photo) {
        const caption = photo.caption.join(' ').trim() || photo.alt;
        slides.push({ kind: 'photo', src: photo.src, caption: inline(caption), info: formatInfo(photoInfo[photo.key]) });
      } else if (text.join('').trim()) {
        const body = text.map((l) => l.replace(/^#+\s*/, '').replace(/^[-*+]\s+/, '• ')).map(inline).join('<br>');
        slides.push({ kind: 'text', html: body });
      }
      photo = null;
      text = [];
    };
    for (const line of block.split(/\r?\n/)) {
      // Each image starts a new slide; text before it belongs to the previous photo.
      for (const part of line.split(IMAGE_SPLIT)) {
        const m = part.match(IMAGE);
        if (m) {
          flush();
          const found = resolve(post, m[2]);
          if (found) photo = { ...found, caption: [], alt: m[1] };
        } else if (photo) {
          if (part.trim()) photo.caption.push(part.trim());
        } else if (part.trim()) {
          text.push(part.trim());
        }
      }
    }
    flush();
  }
  return slides;
}
