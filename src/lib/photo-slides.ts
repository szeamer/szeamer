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

/** "Nikon D700 · 150–600mm at 160mm · f/5.6 · 1/1000s · ISO 320 · 30 Aug 2026" */
function formatInfo(i: PhotoInfo | undefined): string {
  if (!i) return '';
  const focal = i.focalLength ? `${Math.round(i.focalLength)}mm` : '';
  const lens = i.lens && focal && i.lens !== focal ? `${i.lens} at ${focal}` : i.lens || focal;
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

const IMAGE_LINE = /^!\[([^\]]*)\]\(<?([^)>]+)>?\)\s*$/;

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
      const m = line.trim().match(IMAGE_LINE);
      if (m) {
        flush();
        const found = resolve(post, m[2]);
        if (found) photo = { ...found, caption: [], alt: m[1] };
      } else if (photo) {
        if (line.trim()) photo.caption.push(line.trim());
      } else {
        text.push(line.trim());
      }
    }
    flush();
  }
  return slides;
}
