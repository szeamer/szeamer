/**
 * Site-wide settings. The name, tagline, description and social links come
 * from the properties of `Home.md` in the Obsidian `szeamer` folder; the
 * about-me text is the body of that note (rendered in src/pages/index.astro).
 */
import { load } from 'js-yaml';

const homeRaw = Object.values(
  import.meta.glob<string>('../content/vault/Home.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0] ?? '';

const fm = homeRaw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
const home = ((fm && load(fm)) || {}) as Record<string, unknown>;
const text = (key: string) => {
  const v = home[key];
  return v === null || v === undefined || v === '' ? undefined : String(v);
};

export const site = {
  title: text('title') ?? 'Silvia Zeamer',
  /** Used for <title> suffixes and the footer. */
  shortTitle: 'szeamer',
  description: text('description') ?? 'Personal site: writing, art, projects, and photos.',
  /** Shown under your name on the front page. */
  tagline: text('tagline') ?? '',
};

export type NavLink = {
  label: string;
  href: string;
  /** Optional one-line blurb shown next to the link on the front page. */
  blurb?: string;
};

/** Pages linked from the header and from the front page. */
export const navLinks: NavLink[] = [
  { label: 'Art', href: '/art', blurb: 'Drawings and paintings.' },
  { label: 'Projects', href: '/projects', blurb: 'Things I have built.' },
  { label: 'Photos', href: '/photos', blurb: 'Mostly birds and other wildlife.' },
];

export type SocialLink = {
  label: string;
  href: string;
  /** Optional handle/username shown after the label. */
  handle?: string;
};

/** Property name in Home.md → label on the site. Empty properties are skipped. */
const socials: [key: string, label: string, handleKey?: string][] = [
  ['linkedin', 'LinkedIn'],
  ['ebird', 'eBird'],
  ['inaturalist', 'iNaturalist'],
  ['discord', 'Discord', 'discord_handle'],
];

export const socialLinks: SocialLink[] = socials.flatMap(([key, label, handleKey]) => {
  const href = text(key);
  if (!href) return [];
  const handle = handleKey ? text(handleKey) : undefined;
  return [{ label, href, ...(handle ? { handle } : {}) }];
});
