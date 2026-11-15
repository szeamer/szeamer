# szeamer

Personal site built with [Astro](https://astro.build). Static output, no client-side
JavaScript, all styling in plain CSS files you own.

## Running it

```sh
npm install     # once
npm run dev     # http://localhost:4321
npm run build   # static site into dist/
npm run preview # serve the built site
```

Node 22.12.0 is pinned in `.tool-versions` (asdf).

## Emacs workflow

The helpers live in `~/.emacs.d/init.el`, along with `markdown-mode` and `magit`.

**`M-` means Meta.** In iTerm2, set Settings → Profiles → Keys → *Left Option key* to
**Esc+**, and then Left Option acts as Meta. Without that, press `Esc` and then the key
(`Esc x` is the same as `M-x`).

### Site commands

| Command | What it does |
| --- | --- |
| `M-x szeamer-open` | Open the project folder in dired |
| `M-x szeamer-dev` | Start the dev server in the background and open http://localhost:4321 (it reloads when you save) |
| `M-x szeamer-dev-stop` | Stop the dev server |

### Publishing a change (Magit)

1. `C-x g`: open Magit status
2. `s` on a file stages it, or `S` stages everything
3. `c c`: start a commit, type the message, then `C-c C-c` to finish (or `C-c C-k` to cancel)
4. `P p`: push. The host rebuilds the site automatically

Also useful in Magit: `TAB` expands a diff, `u` unstages, `g` refreshes, `q` quits.

### Adding images

Shrink exports before you add them so the repo stays small (Astro makes the web sizes itself):

```sh
sips -Z 2400 ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/szeamer/Photos/*.jpg
```

Run shell commands with `M-!` (or `M-&` to run them asynchronously). In dired, `C` copies files,
`R` renames or moves them, `+` creates a directory, and `D` deletes.

### Emacs keys to remember

| Keys | Action |
| --- | --- |
| `C-g` | Cancel whatever is happening |
| `C-x C-f` / `C-x C-s` | Open file / save |
| `C-x b` / `C-x k` | Switch buffer / close buffer |
| `C-/` | Undo |
| `C-s` | Search forward |
| `M-q` | Re-wrap the current paragraph |
| `C-c C-l` | Insert a link (markdown) |
| `C-c C-s b` / `C-c C-s i` | Bold / italic (markdown) |
| `C-h k` then a key | Explain what that key does |

## Editing content (in Obsidian)

All content lives in the **`szeamer` folder of the Obsidian vault**
(`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/szeamer`). The site reads a
copy of it in `src/content/vault/`, made by `npm run sync`. Never edit that copy by
hand, because the next sync overwrites it.

| What | Where in Obsidian |
| --- | --- |
| Name, tagline, description, social links | Properties of `Home.md` |
| About-me text on the front page | Body of `Home.md` |
| Blog posts | One note per post in `Blog/` |
| Projects | One note per project in `Projects/` (properties `link`, `meta`, `order`) |
| Art / photos | Images in `Art/` / `Photos/`; titles and captions in `Art.md` / `Photos.md` |
| Header/front-page links | `navLinks` in `src/data/site.ts` (code, not Obsidian) |

Templates `website post` and `website project` are in the vault's `templates` folder.

### Posts

The note name is the title and the URL: `First frost` → `/blog/first-frost/`.
Properties: `date` (required to publish), `description` (optional, for RSS), and
`draft` (checked = hidden on the live site). A post with no `date` stays a draft.

Obsidian syntax is converted for you: pasted/embedded images (`![[photo.jpg]]`) work
wherever Obsidian saved them; `[[Another post]]` becomes a link; links to notes outside
the website folder become plain text; `%% comments %%` are removed. Embedding a whole
note (`![[Some note]]`) isn't supported.

### Art and photos

Anything in `Art/` or `Photos/` shows up. To set a title, year, caption or order, embed
the image in `Art.md` / `Photos.md` like this (blank line between pieces):

```
![[2026-04-great-egret.jpg]]
Great Egret (2026)
Parker River NWR, April.
```

Listed images come first, in that order; the rest follow, titled from their filename.

### Publishing

Nothing goes live until you publish. In Obsidian, the left sidebar has two buttons
(also in the command palette, `Cmd-P`) from the `szeamer website` plugin
(`.obsidian/plugins/szeamer-publish` in the vault):

| Button | What it does |
| --- | --- |
| ☁ **Publish website** | Sync the folder, check the site builds, commit `src/content/vault`, push |
| 👁 **Preview website** | Run the site at http://localhost:4321, updating as you type. Click again to stop |

A failed build is never pushed; the notice says what went wrong, and the full output
goes to `~/Library/Logs/szeamer-publish.log`. Only `src/content/vault/` is committed
by Publish. Code changes still go through Magit as before.

From a terminal, the same things are `npm run publish`, and `npm run dev` with
`npm run watch` next to it. `scripts/com.szeamer.obsidian-publish.plist` is an optional
LaunchAgent that publishes automatically 60s after you stop editing (off by default).

## Editing the styling

All CSS lives in `src/styles/`. No component contains a `<style>` block, so
these four files are the whole design:

| File | Contents |
| --- | --- |
| `tokens.css` | **Start here.** Every colour, font, size and spacing value, as CSS variables. |
| `base.css` | Element defaults — body, headings, links, images, lists. |
| `layout.css` | Header, nav, page column widths, footer. |
| `components.css` | Post timeline, link lists, galleries, project list, post prose. |

`global.css` just imports the four in order, and is the only stylesheet the
layout loads.

Common changes, all in `tokens.css`:

- **Colours** — `--color-bg`, `--color-text`, `--color-accent`, etc. Light values
  sit in `:root`; dark values in the `prefers-color-scheme: dark` block below it.
  To drop dark mode entirely, delete that block.
- **Fonts** — `--font-body` and `--font-heading`. For a webfont, add the `<link>`
  in `src/layouts/Base.astro` and name it here.
- **Page width** — `--measure` (text pages) and `--measure-wide` (galleries).
- **Gallery density** — `--gallery-min-tile` sets how small a tile may get
  before the grid reflows to fewer columns; `--gallery-gap` sets the spacing.

## Structure

```
src/
  components/                Header, Footer, Gallery, PostTimeline, SocialLinks
  content/vault/             copy of the Obsidian folder (generated, don't edit)
  data/                      site.ts, art.ts, photos.ts (read from content/vault)
scripts/                     obsidian-sync.mjs, obsidian-watch.mjs
  layouts/Base.astro         <head>, header, footer, stylesheet import
  lib/                       post sorting/formatting, gallery building
  pages/                     index, art, projects, photos, blog/[...slug], rss.xml
  styles/                    tokens, base, layout, components
```

## Deploying

`npm run build` writes a plain static site to `dist/`. Netlify, Cloudflare Pages,
GitHub Pages and Vercel all work with no configuration beyond that build command
and output directory. Set `site:` in `astro.config.mjs` to your real domain first.
