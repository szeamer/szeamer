import { galleryFromNote } from '../lib/gallery';

/**
 * Images in the `Art` folder of the Obsidian `szeamer` folder appear on
 * /art. Titles, years, captions and order come from `Art.md` there.
 */
const note = Object.values(
  import.meta.glob<string>('../content/vault/Art.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../content/vault/{Art,attachments}/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG}',
  { eager: true },
);

export const art = galleryFromNote(note, 'Art', images);
