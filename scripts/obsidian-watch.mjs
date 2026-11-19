#!/usr/bin/env node
/**
 * Watches the Obsidian `szeamer` folder. When you stop editing for a little
 * while, it syncs the folder into the site, checks that the site builds, then
 * commits and pushes, and the host rebuilds the live site.
 *
 * Obsidian saves on every keystroke, so it waits until you have been idle for
 * SZEAMER_DELAY seconds (default 60) before publishing.
 *
 * Usage:
 *   node scripts/obsidian-watch.mjs              watch + publish
 *   node scripts/obsidian-watch.mjs --preview    watch + sync only (for `npm run dev`)
 *   node scripts/obsidian-watch.mjs --once       sync + publish once, then exit
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEST, REPO, SRC } from './obsidian-sync.mjs';

/**
 * Loads the sync code fresh each time, so a long-running preview picks up changes
 * to scripts/obsidian-sync.mjs instead of running the version it started with.
 */
async function sync(options) {
  const mod = await import(`./obsidian-sync.mjs?v=${fs.statSync(new URL('./obsidian-sync.mjs', import.meta.url)).mtimeMs}`);
  return mod.sync(options);
}

const preview = process.argv.includes('--preview');
const once = process.argv.includes('--once');
const delay = (Number(process.env.SZEAMER_DELAY) || (preview ? 1 : 60)) * 1000;
const CONTENT = path.relative(REPO, DEST);

const stamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const log = (...a) => console.log(`[${stamp()}]`, ...a);

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

/** A macOS notification, so you can tell whether a publish worked without a terminal. */
function notify(message) {
  if (process.env.SZEAMER_NO_NOTIFY) return; // the Obsidian button shows its own notice
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  spawnSync('osascript', ['-e', `display notification "${esc(message)}" with title "szeamer"`]);
}

function publish() {
  if (!run('git', ['rev-parse', '--git-dir']).ok) return log('Not a git repo; skipping publish.');
  const build = run(process.execPath, [path.join(REPO, 'node_modules/astro/bin/astro.mjs'), 'build']);
  if (!build.ok) {
    log(`Build failed, so nothing was published:\n${build.out.split('\n').slice(-25).join('\n')}`);
    process.exitCode = 1;
    return notify('Not published: the site failed to build.');
  }
  // Only the synced content is committed, so half-finished code changes never ship by accident.
  run('git', ['add', '-A', '--', CONTENT]);
  if (run('git', ['diff', '--cached', '--quiet', '--', CONTENT]).ok) return log('Nothing new to publish.');
  const commit = run('git', ['commit', '-m', 'Update from Obsidian', '--', CONTENT]);
  if (!commit.ok) {
    process.exitCode = 1;
    return log(`Commit failed:\n${commit.out}`), notify('Not published: git commit failed.');
  }
  if (!run('git', ['remote', 'get-url', 'origin']).ok) {
    return log('Committed. No git remote is set up yet, so nothing was pushed.');
  }
  const push = run('git', ['push', '-u', 'origin', 'HEAD']);
  if (!push.ok) {
    process.exitCode = 1;
    return log(`Push failed:\n${push.out}`), notify('Not published: git push failed.');
  }
  log('Published.');
  notify('Published your changes.');
}

let timer = null;
let busy = false;
let again = false;

async function cycle() {
  if (busy) return void (again = true);
  busy = true;
  try {
    const { changed } = await sync({ quiet: false });
    if (!preview && (changed || once)) publish();
  } catch (e) {
    log(`Sync failed: ${e.message}`);
    process.exitCode = 1;
    if (!preview) notify(`Not published: ${e.message}`);
  } finally {
    busy = false;
    if (again) {
      again = false;
      schedule();
    }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(cycle, delay);
}

if (once) {
  await cycle();
} else {
  if (!fs.existsSync(SRC)) {
    console.error(`Website folder not found: ${SRC}`);
    process.exit(1);
  }
  log(`Watching ${SRC}`);
  log(preview ? 'Preview mode: syncing only, not publishing.' : `Publishing ${delay / 1000}s after you stop editing.`);
  cycle();
  fs.watch(SRC, { recursive: true }, (_event, file) => {
    if (file && /(^|[\\/])\./.test(file)) return; // .DS_Store, .obsidian, iCloud temp files
    schedule();
  });
}
