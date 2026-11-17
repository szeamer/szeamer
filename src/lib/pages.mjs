/**
 * Which sections are switched on, from the `pages` property of Home.md.
 *
 *   pages: [Writing, Art, Projects, Photos]   → all of them
 *   pages: []  (or the property left empty)    → just the landing page
 *   no `pages` property at all                 → all of them
 *
 * A hidden section isn't linked anywhere, and its page isn't built at all.
 */
export const SECTIONS = ['writing', 'art', 'projects', 'photos'];

/** @param {Record<string, unknown>} home  Home.md's properties */
export function shownSections(home) {
  if (!('pages' in home)) return new Set(SECTIONS);
  const list = Array.isArray(home.pages) ? home.pages : home.pages ? [home.pages] : [];
  return new Set(
    list.map((p) => String(p).replace(/^\[\[|\]\]$/g, '').trim().toLowerCase()).filter(Boolean),
  );
}
