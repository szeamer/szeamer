export type GalleryEntry = {
  /** Overrides the title derived from the filename. */
  title?: string;
  /** Optional longer line shown under the title. */
  caption?: string;
  year?: string | number;
  /** Lower numbers sort first. Items without `order` come last, newest filename first. */
  order?: number;
};

/** Keyed by filename without extension, e.g. `2026-04-heron`. */
export type GalleryMeta = Record<string, GalleryEntry>;

export type GalleryItem = GalleryEntry & {
  id: string;
  src: ImageMetadata;
  title: string;
};

/** Strips a leading `2026-04-` style date prefix and turns dashes into spaces. */
function titleFromFilename(id: string): string {
  const words = id.replace(/^[\d]{4}(-[\d]{2}){0,2}[-_]?/, '').replace(/[-_]+/g, ' ').trim();
  const text = words || id;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Turns an `import.meta.glob(..., { eager: true })` result into gallery items.
 * Drop a new image into the folder and it shows up — metadata is optional.
 */
export function buildGallery(
  modules: Record<string, { default: ImageMetadata }>,
  meta: GalleryMeta = {},
): GalleryItem[] {
  return Object.entries(modules)
    .map(([path, mod]) => {
      const id = path.split('/').pop()!.replace(/\.[^.]+$/, '');
      const entry = meta[id] ?? {};
      return { ...entry, id, src: mod.default, title: entry.title ?? titleFromFilename(id) };
    })
    .sort((a, b) => {
      const byOrder = (a.order ?? Infinity) - (b.order ?? Infinity);
      return byOrder !== 0 ? byOrder : b.id.localeCompare(a.id);
    });
}

type ImageModules = Record<string, { default: ImageMetadata }>;

/** `../content/vault/Art/x.jpg` → `Art/x.jpg` */
const vaultPath = (globKey: string) => globKey.replace(/^.*?content\/vault\//, '');

/**
 * Builds a gallery from an Obsidian note such as `Art.md`, plus a folder of images.
 *
 * In the note, each block that starts with an image is one item:
 *
 *     ![[great-egret.jpg]]
 *     Great Egret (2026)
 *     Parker River NWR, April.
 *
 * Line 2 is the title (optional year in brackets), the rest is the caption.
 * Listed images come first, in note order; other images in `folder` follow.
 * (The sync script has already turned `![[…]]` into `![](<./Art/…>)`.)
 */
export function galleryFromNote(
  note: string | undefined,
  folder: string,
  images: ImageModules,
): GalleryItem[] {
  const byPath = new Map(Object.entries(images).map(([k, v]) => [vaultPath(k), v.default]));
  const listed: GalleryItem[] = [];
  const seen = new Set<string>();
  const body = (note ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  for (const block of body.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const m = lines[0]?.match(/^!\[[^\]]*\]\(<?\.?\/?([^>)]+)>?\)$/);
    if (!m) continue;
    const path = decodeURI(m[1]);
    const src = byPath.get(path);
    if (!src || seen.has(path)) continue;
    seen.add(path);
    const id = path.split('/').pop()!.replace(/\.[^.]+$/, '');
    const titleLine = (lines[1] ?? '').replace(/^#+\s*/, '').replace(/[*_]/g, '').trim();
    const year = titleLine.match(/\s*\((\d{4})\)\s*$/);
    const title = (year ? titleLine.slice(0, year.index) : titleLine).trim();
    const caption = lines.slice(2).join(' ').replace(/[*_]/g, '').trim();
    listed.push({
      id,
      src,
      title: title || titleFromFilename(id),
      ...(year ? { year: year[1] } : {}),
      ...(caption ? { caption } : {}),
    });
  }

  const rest = Object.fromEntries(
    Object.entries(images).filter(([k]) => {
      const p = vaultPath(k);
      return p.startsWith(`${folder}/`) && !seen.has(p);
    }),
  );
  return [...listed, ...buildGallery(rest)];
}
