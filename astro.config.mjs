// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { SECTIONS, shownSections } from './src/lib/pages.mjs';

/** Leaves sections switched off in Home.md (`pages` property) out of the built site. */
function hiddenSections() {
  return {
    name: 'hidden-sections',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        let home = {};
        try {
          const raw = fs.readFileSync(new URL('./src/content/vault/Home.md', import.meta.url), 'utf8');
          home = load(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '') ?? {};
        } catch {}
        const shown = shownSections(home);
        for (const section of SECTIONS) {
          if (shown.has(section)) continue;
          const folder = section === 'writing' ? 'blog' : section;
          fs.rmSync(new URL(`./${folder}/`, dir), { recursive: true, force: true });
          logger.info(`left out /${folder} (not listed in the pages property of Home.md)`);
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  integrations: [hiddenSections()],
  // TODO: set this to your real domain — it is used for absolute URLs in /rss.xml.
  site: 'https://example.com',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
