#!/usr/bin/env node
/**
 * Copies the `szeamer` folder of the Obsidian vault into `src/content/vault/`,
 * converting Obsidian-only syntax into plain markdown on the way:
 *
 *   ![[photo.jpg]]          → ![](relative/path/photo.jpg)   (image is copied too,
 *                              wherever in the vault Obsidian saved it)
 *   [[First frost]]         → [First frost](/blog/first-frost/)  (if it is a post)
 *   [[Some private note]]   → Some private note   (plain text; nothing leaks)
 *   %% comment %%           → removed
 *
 * Only the website folder and images it embeds are copied. Nothing else in the
 * vault is read beyond file names (to find embedded images).
 *
 * Usage: node scripts/obsidian-sync.mjs
 * Env:   SZEAMER_VAULT   vault root (default: the iCloud Obsidian vault)
 *        SZEAMER_FOLDER  folder inside the vault (default: szeamer)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug } from 'github-slugger';
import sharp from 'sharp';
import exifr from 'exifr';
import { execFileSync } from 'node:child_process';

export const VAULT =
  process.env.SZEAMER_VAULT ??
  path.join(os.homedir(), 'Library/Mobile Documents/iCloud~md~obsidian/Documents');
export const FOLDER = process.env.SZEAMER_FOLDER ?? 'szeamer';
export const SRC = path.join(VAULT, FOLDER);
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEST = path.join(REPO, 'src/content/vault');

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i;
/** Where the camera details of each photo are written for the site (no location). */
const PHOTO_INFO = 'photo-info.json';

/** Nikon/Canon/… brand names as written in EXIF, tidied for display. */
function tidyCamera(make = '', model = '') {
  const brand = make.replace(/\s+(CORPORATION|CORP\.?|COMPANY|CO\.,? ?LTD\.?|IMAGING.*|OPTICAL.*)$/i, '').trim();
  const titled = (w) => (/^[A-Z]{2,}$/.test(w) && w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w);
  const name = model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`;
  return name.trim().split(/\s+/).map(titled).join(' ');
}

/** "150.0-600.0 mm f/5.0-6.3" → "150–600mm" */
function tidyLens(lens = '') {
  const m = lens.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*mm/i);
  if (!m) return lens.trim() || undefined;
  const n = (v) => String(Number(v));
  return m[2] && Number(m[2]) !== Number(m[1]) ? `${n(m[1])}–${n(m[2])}mm` : `${n(m[1])}mm`;
}

/**
 * Camera, lens, settings and date taken for one photo, read from the original
 * before its metadata is stripped. Location is never read.
 */
async function photoInfo(file) {
  let exif = {};
  try {
    exif = (await exifr.parse(file, {
      pick: ['Make', 'Model', 'LensModel', 'FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'DateTimeOriginal'],
      reviveValues: false,
    })) ?? {};
  } catch {}
  let lens = exif.LensModel;
  if (!lens && process.platform === 'darwin') {
    // Some cameras (e.g. Nikon) keep the lens in maker notes; macOS can read those.
    try {
      const v = execFileSync('mdls', ['-raw', '-name', 'kMDItemLensModel', file], { encoding: 'utf8' }).trim();
      if (v && v !== '(null)') lens = v;
    } catch {}
  }
  const date = String(exif.DateTimeOriginal ?? '').match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  const info = {
    camera: exif.Model ? tidyCamera(exif.Make, exif.Model) : undefined,
    lens: tidyLens(lens),
    focalLength: exif.FocalLength,
    aperture: exif.FNumber,
    exposure: exif.ExposureTime,
    iso: exif.ISO,
    taken: date ? `${date[1]}-${date[2]}-${date[3]}` : undefined,
  };
  return Object.values(info).some((v) => v !== undefined) ? info : undefined;
}

/** Longest edge kept in the repo; Astro makes the smaller web sizes from this. */
const MAX_EDGE = 2400;

/**
 * Copies a photo into the site, shrunk to MAX_EDGE and with its metadata
 * (camera details, GPS location) stripped, since the repo is public.
 */
async function copyImage(src, dest) {
  const ext = path.extname(src).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return fs.copyFileSync(src, dest);
  let img = sharp(src).rotate().resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true });
  if (ext === '.png') img = img.png();
  else if (ext === '.webp') img = img.webp({ quality: 88 });
  else img = img.jpeg({ quality: 88, mozjpeg: true });
  await img.toFile(dest);
}
const ATTACHMENTS = 'attachments';
/** Top-level notes that map to site pages, for [[wikilinks]]. */
const PAGE_URLS = { home: '/', projects: '/projects', art: '/art', photos: '/photos' };

const posix = (p) => p.split(path.sep).join('/');

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

const stem = (p) => path.basename(p).replace(/\.[^.]+$/, '');

/** Splits `---\nyaml\n---\nbody` into its parts. */
function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? { fm: m[1], body: text.slice(m[0].length) } : { fm: null, body: text };
}

const hasKey = (fm, key) => new RegExp(`^${key}:[ \\t]*\\S`, 'm').test(fm);

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Fills in what Obsidian users usually leave implicit:
 * the title defaults to the note name, and a post with no date stays a draft.
 */
function fixFrontmatter(fm, file, kind) {
  let out = fm ?? '';
  const add = (line) => (out = out ? `${out}\n${line}` : line);
  if (kind === 'post' || kind === 'project') {
    if (!hasKey(out, 'title')) {
      out = out.replace(/^title:.*$/m, '');
      add(`title: ${JSON.stringify(stem(file))}`);
    }
  }
  if (kind === 'post' && !hasKey(out, 'date')) {
    out = out.replace(/^(date|draft):.*$/gm, '');
    add(`date: ${isoDay(fs.statSync(file).birthtime)}`);
    add('draft: true # no date set in Obsidian, so this stays a draft');
  }
  return out.replace(/\n{2,}/g, '\n').trim();
}

/** Column width of leading whitespace, with tabs at 4-column stops. */
function indentWidth(ws) {
  let n = 0;
  for (const c of ws) n = c === '\t' ? n + 4 - (n % 4) : n + 1;
  return n;
}

/**
 * Obsidian nests lists by indenting with tabs (and is forgiving about how
 * many). Strict markdown wants a nested item indented to exactly where its
 * parent's text starts, or it reads the line as more text of the parent item
 * ("- books: - The Lord of the Rings - A God in Ruins …"). Re-indent every list
 * item to its parent's text column, keeping Obsidian's nesting.
 */
function normalizeListIndent(text) {
  const stack = []; // { w: original indent, col: column where the item's text starts }
  return text
    .split('\n')
    .map((line) => {
      const m = line.match(/^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/);
      if (!m) {
        if (line.trim() && !/^[ \t]/.test(line)) stack.length = 0; // unindented text ends the list
        return line;
      }
      const w = indentWidth(m[1]);
      while (stack.length && stack.at(-1).w >= w) stack.pop();
      const indent = stack.length ? stack.at(-1).col : 0;
      stack.push({ w, col: indent + m[2].length + 1 });
      return `${' '.repeat(indent)}${m[2]} ${m[3]}`;
    })
    .join('\n');
}

export async function sync({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const warnings = [];
  if (!fs.existsSync(SRC)) throw new Error(`Website folder not found: ${SRC}`);

  const srcFiles = walk(SRC);
  // Every file in the vault, by name, so embeds resolve the way Obsidian resolves them.
  const byName = new Map();
  const byPath = new Map();
  for (const f of [...srcFiles, ...walk(VAULT).filter((f) => !f.startsWith(SRC + path.sep))]) {
    const name = path.basename(f).toLowerCase();
    if (!byName.has(name)) byName.set(name, f); // website folder wins on clashes
    byPath.set(posix(path.relative(VAULT, f)).toLowerCase(), f);
  }

  // Where each note lives on the site, for [[wikilinks]].
  const noteUrl = new Map();
  for (const f of srcFiles) {
    if (!f.endsWith('.md')) continue;
    const rel = posix(path.relative(SRC, f));
    const key = stem(f).toLowerCase();
    if (rel.startsWith('Blog/')) noteUrl.set(key, `/blog/${slug(stem(f))}/`);
    else if (rel.startsWith('Photos/')) noteUrl.set(key, `/photos/${slug(stem(f))}/`);
    else if (rel.startsWith('Projects/')) noteUrl.set(key, '/projects');
    else if (PAGE_URLS[key]) noteUrl.set(key, PAGE_URLS[key]);
  }

  /** destination rel path → { copy: source file } or { text: contents }. */
  const out = new Map();

  function resolveImage(target) {
    const clean = decodeURI(target.split('#')[0].trim());
    const found =
      byPath.get(clean.toLowerCase()) ??
      byPath.get(posix(path.join(FOLDER, clean)).toLowerCase()) ??
      byName.get(path.basename(clean).toLowerCase());
    if (!found) return null;
    const destRel = found.startsWith(SRC + path.sep)
      ? posix(path.relative(SRC, found))
      : `${ATTACHMENTS}/${path.basename(found)}`;
    out.set(destRel, { copy: found });
    return destRel;
  }

  function convert(body, noteRel) {
    const noteDir = path.posix.dirname(noteRel);
    const link = (destRel) => {
      let rel = path.posix.relative(noteDir, destRel);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `<${rel}>`;
    };
    const image = (target, alt, original) => {
      if (!IMAGE.test(target.split('#')[0])) {
        warnings.push(`${noteRel}: embedding notes isn't supported, dropped ${original}`);
        return '';
      }
      const destRel = resolveImage(target);
      if (!destRel) {
        warnings.push(`${noteRel}: image not found in vault, dropped ${original}`);
        return '';
      }
      return `![${alt}](${link(destRel)})`;
    };

    const convertText = (text) =>
      normalizeListIndent(text)
        .replace(/%%[\s\S]*?%%/g, '')
        // ![[image.png|alt or 300]]
        .replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (m, target, alias = '') =>
          image(target, /^\d+(x\d+)?$/.test(alias.trim()) ? '' : alias.trim(), m),
        )
        // ![alt](local image.png) — Obsidian writes these when wikilinks are off
        .replace(/!\[([^\]]*)\]\(<?([^)>]+?)>?\)/g, (m, alt, target) =>
          /^[a-z]+:\/\//i.test(target) || target.startsWith('/') ? m : image(target, alt, m),
        )
        // [[Note#heading|label]]
        .replace(/\[\[([^\]|#]*)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (m, target, heading, label) => {
          const text = (label ?? target ?? heading?.slice(1) ?? '').trim();
          const url = noteUrl.get(stem(target.trim()).toLowerCase());
          return url ? `[${text}](${url})` : text;
        });

    // Leave fenced code blocks alone.
    return body
      .split(/(^(?:```|~~~)[\s\S]*?^(?:```|~~~)[ \t]*$)/m)
      .map((chunk, i) => (i % 2 ? chunk : convertText(chunk)))
      .join('');
  }

  for (const f of srcFiles) {
    const rel = posix(path.relative(SRC, f));
    if (f.endsWith('.md')) {
      const kind = /^(Blog|Photos)\//.test(rel) ? 'post' : rel.startsWith('Projects/') ? 'project' : 'page';
      const { fm, body } = splitFrontmatter(fs.readFileSync(f, 'utf8'));
      const newFm = fixFrontmatter(fm, f, kind);
      const converted = convert(body, rel);
      out.set(rel, { text: newFm ? `---\n${newFm}\n---\n${converted}` : converted });
    } else if (IMAGE.test(f)) {
      out.set(rel, { copy: f });
    }
  }

  // Camera details for every photo, keyed by its path in src/content/vault.
  const info = {};
  for (const [rel, { copy }] of [...out].sort(([a], [b]) => a.localeCompare(b))) {
    if (copy && /\.(jpe?g|tiff?|heic|webp|png)$/i.test(copy)) {
      const details = await photoInfo(copy);
      if (details) info[rel] = details;
    }
  }
  out.set(PHOTO_INFO, { text: `${JSON.stringify(info, null, 2)}\n` });

  // Write only what changed, so the dev server reloads just the affected page.
  let changed = 0;
  for (const [rel, { copy: src, text: data }] of out) {
    const dest = path.join(DEST, rel);
    if (data !== undefined) {
      if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === data) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
    } else {
      const s = fs.statSync(src);
      // The copy is resized, so compare modification times only (the copy keeps the original's).
      if (fs.existsSync(dest) && Math.abs(fs.statSync(dest).mtimeMs - s.mtimeMs) < 1000) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await copyImage(src, dest);
      fs.utimesSync(dest, s.atime, s.mtime);
    }
    changed++;
    log(`  updated ${rel}`);
  }
  for (const f of walk(DEST)) {
    const rel = posix(path.relative(DEST, f));
    if (!out.has(rel)) {
      fs.rmSync(f);
      changed++;
      log(`  removed ${rel}`);
    }
  }
  for (const w of warnings) console.warn(`  warning: ${w}`);
  log(changed ? `Synced ${changed} change(s) from Obsidian.` : 'Already up to date.');
  return { changed, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await sync();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
