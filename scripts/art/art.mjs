#!/usr/bin/env node
/**
 * Project Apex art generator (OpenAI Images API).
 *
 *   npm run art:check                      connection + key check, generates nothing
 *   npm run art:plan -- portraits          show prompts, sizes and rough cost, generates nothing
 *   npm run art:make -- portraits          generate missing images in a set
 *        --only p001,p003                  only these ids
 *        --redo                            regenerate even if the image exists
 *        --max 10                          safety cap on images per run (default 10)
 *
 * The API key comes either from a cloud-environment network secret for
 * api.openai.com (the proxy attaches it; this script never sees it) or from the
 * OPENAI_API_KEY environment variable. It is never printed, logged or written to disk. Images land in
 * src/renderer/assets/generated/<set>/<id>.webp, where the game picks them up,
 * and art/manifest.json records the exact prompt and model for every file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, accessSync, constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SPECS = join(ROOT, 'src/shared/art');
const OUT = join(ROOT, 'src/renderer/assets/generated');
const MANIFEST = join(ROOT, 'art/manifest.json');
const API = 'https://api.openai.com/v1';
const MODEL = process.env.APEX_IMAGE_MODEL || 'gpt-image-1';

// Approximate USD per image for gpt-image-1 (OpenAI pricing page, 2025). Shown as a guide only.
const COST = {
  '1024x1024': { low: 0.011, medium: 0.042, high: 0.167 },
  '1536x1024': { low: 0.016, medium: 0.063, high: 0.25 },
  '1024x1536': { low: 0.016, medium: 0.063, high: 0.25 },
};

const ok = (s) => console.log(`  ✔ ${s}`);
const bad = (s) => console.log(`  ✘ ${s}`);
const info = (s) => console.log(`    ${s}`);

function loadSet(name) {
  const file = join(SPECS, `${name}.json`);
  if (!existsSync(file)) {
    console.error(`No art set called "${name}". Available: portraits, maps`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The full prompt for one item: the set's shared style plus the item's own description. */
export function promptFor(set, item) {
  if (set.set === 'portraits') {
    return `${set.style}\n\nSubject: ${item.subject}. Jersey colors: ${item.jersey}.`;
  }
  return `${set.style}\n\nScene: ${item.subject}.`;
}

function outPath(set, item) {
  return join(OUT, set.set, `${item.id}.webp`);
}

function key() {
  const k = process.env.OPENAI_API_KEY;
  return k && k.trim().length > 20 ? k.trim() : null;
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    // Without a local key, a cloud network secret for api.openai.com supplies the Authorization header.
    headers: { ...(key() ? { Authorization: `Bearer ${key()}` } : {}), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body };
}

/** Plain-English explanation of an API failure. */
function explain(status, body) {
  const msg = body?.error?.message ?? '';
  const code = body?.error?.code ?? '';
  if (status === 401) return 'OpenAI rejected the API key. It may be mistyped, revoked, or from a different project.';
  if (status === 429 && code === 'insufficient_quota') return 'The OpenAI account has no credit. Add a payment method or credit at platform.openai.com > Billing.';
  if (status === 429) return 'OpenAI says we are sending requests too fast. Wait a minute and try again.';
  if (status === 403 && /verif/i.test(msg)) return 'OpenAI requires your organization to be verified before it can use this image model (platform.openai.com > Settings > Organization > General > Verify).';
  if (status === 400 && /safety|policy|moderation/i.test(msg)) return `OpenAI's safety filter declined this prompt: ${msg}`;
  return `OpenAI returned HTTP ${status}${msg ? `: ${msg}` : ''}`;
}

async function check({ quiet = false } = {}) {
  const say = quiet ? () => {} : console.log;
  say('\nProject Apex art setup check (no images will be generated)\n');
  let pass = true;

  if (key()) ok('API key found in OPENAI_API_KEY (not shown)');
  else if (!quiet) info('No OPENAI_API_KEY variable; checking for a network secret on api.openai.com instead');

  try {
    mkdirSync(join(OUT, 'portraits'), { recursive: true });
    accessSync(OUT, constants.W_OK);
    if (!quiet) ok('Image folder is writable (src/renderer/assets/generated)');
  } catch {
    bad('Cannot write to src/renderer/assets/generated');
    pass = false;
  }

  let r;
  try {
    r = await api('/models');
  } catch (e) {
    bad('Could not reach api.openai.com. This environment\'s network settings are probably blocking it.');
    info('Fix: add your key as a Network secret for api.openai.com (or allow that domain) in the environment settings.');
    info(`(technical detail: ${e?.cause?.code ?? e?.message ?? e})`);
    return false;
  }
  if (r.status === 401 && !key()) {
    bad('OpenAI answered but no key reached it. Add your key as a Network secret for api.openai.com in the environment settings.');
    return false;
  }
  if (r.status !== 200) {
    bad(explain(r.status, r.body));
    return false;
  }
  if (!quiet) ok('Connected to OpenAI and the key works');

  const ids = (r.body?.data ?? []).map((m) => m.id);
  const imageModels = ids.filter((id) => /^(gpt-image|dall-e)/.test(id)).sort();
  if (ids.includes(MODEL)) {
    if (!quiet) ok(`Image model "${MODEL}" is available to this key`);
  } else {
    bad(`Image model "${MODEL}" is not available to this key.`);
    if (imageModels.length) info(`Image models this key can use: ${imageModels.join(', ')}`);
    pass = false;
  }
  if (!quiet && imageModels.length) info(`(all image models on this key: ${imageModels.join(', ')})`);
  say(pass ? '\nSetup looks good. Nothing was generated and nothing was charged.\n' : '\nSetup is not ready yet (see above).\n');
  return pass;
}

function parseArgs(argv) {
  const opts = { set: null, only: null, redo: false, max: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = new Set(argv[++i].split(','));
    else if (a === '--redo') opts.redo = true;
    else if (a === '--max') opts.max = Number(argv[++i]);
    else if (!a.startsWith('--')) opts.set = a;
  }
  return opts;
}

function selected(set, opts) {
  return set.items.filter((it) => (!opts.only || opts.only.has(it.id)) && (opts.redo || !existsSync(outPath(set, it))));
}

function plan(opts) {
  const set = loadSet(opts.set ?? 'portraits');
  const todo = selected(set, opts);
  const each = COST[set.size]?.[set.quality] ?? 0;
  console.log(`\nArt set "${set.set}": ${set.items.length} defined, ${todo.length} to generate (model ${MODEL}, ${set.size}, quality ${set.quality})\n`);
  for (const it of set.items) {
    const status = existsSync(outPath(set, it)) ? (opts.redo && (!opts.only || opts.only.has(it.id)) ? 'will redo' : 'already made') : todo.includes(it) ? 'will generate' : 'skipped';
    console.log(`- ${it.id}  ${it.name}${it.nickname ? ` "${it.nickname}"` : ''}  [${status}]`);
  }
  if (todo[0]) console.log(`\nExample full prompt (${todo[0].id}):\n\n${promptFor(set, todo[0])}\n`);
  console.log(`Rough cost: about $${(each * todo.length).toFixed(2)} (≈ $${each.toFixed(3)} per image; check OpenAI's pricing page for current rates).`);
  if (todo.length > opts.max) console.log(`Note: a single run is capped at ${opts.max} images. Use --max to raise it.`);
  console.log('Nothing was generated.\n');
}

function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { files: {} };
}

async function make(opts) {
  const set = loadSet(opts.set ?? 'portraits');
  if (!(await check({ quiet: true }))) {
    console.log('\nSetup check failed, so nothing was generated. Run: npm run art:check\n');
    process.exit(1);
  }
  const todo = selected(set, opts);
  if (todo.length === 0) {
    console.log('Nothing to generate: every image in this set already exists (use --redo to replace).');
    return;
  }
  if (todo.length > opts.max) {
    console.log(`Refusing to generate ${todo.length} images in one run (cap ${opts.max}). Use --max ${todo.length} if you mean it.`);
    process.exit(1);
  }
  const manifest = readManifest();
  let made = 0;
  for (const it of todo) {
    const prompt = promptFor(set, it);
    process.stdout.write(`Generating ${set.set}/${it.id} (${it.name})... `);
    const r = await api('/images/generations', {
      method: 'POST',
      body: JSON.stringify({ model: MODEL, prompt, size: set.size, quality: set.quality, output_format: 'webp', output_compression: 90, n: 1 }),
    });
    const b64 = r.body?.data?.[0]?.b64_json;
    if (r.status !== 200 || !b64) {
      console.log('failed');
      info(explain(r.status, r.body));
      if (r.status === 401 || r.status === 403 || r.status === 429) break;
      continue;
    }
    const file = outPath(set, it);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(b64, 'base64'));
    manifest.files[`${set.set}/${it.id}.webp`] = {
      model: MODEL, size: set.size, quality: set.quality, prompt,
      revisedPrompt: r.body.data[0].revised_prompt ?? null, createdAt: new Date().toISOString(),
    };
    mkdirSync(dirname(MANIFEST), { recursive: true });
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    made++;
    console.log('done');
  }
  console.log(`\n${made} of ${todo.length} image(s) saved to src/renderer/assets/generated/${set.set}/\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
if (cmd === 'check') process.exit((await check()) ? 0 : 1);
else if (cmd === 'plan') plan(opts);
else if (cmd === 'make') await make(opts);
else console.log('Usage: npm run art:check | art:plan -- <set> | art:make -- <set> [--only ids] [--redo] [--max n]');
