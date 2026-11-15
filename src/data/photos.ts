import { galleryFromNote } from '../lib/gallery';

/**
 * Images in the `Photos` folder of the Obsidian `szeamer` folder appear on
 * /photos. Titles, years, captions and order come from `Photos.md` there.
 */
const note = Object.values(
  import.meta.glob<string>('../content/vault/Photos.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0];

const images = import.meta.glob<{ default: ImageMetadata }>(
  '../content/vault/{Photos,attachments}/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG}',
  { eager: true },
);

export const photos = galleryFromNote(note, 'Photos', images);
