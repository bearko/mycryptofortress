#!/usr/bin/env node
// SPEC-101 §5.2: assets.manifest.json に登録された MCH アセットだけを
// bearko/mycryptoheroes から web/public/assets/mch/ に同期・検査する。
//
//   node scripts/sync-assets.mjs            ローカルクローンからコピー（MCH_REPO_DIR、既定 ../../mycryptoheroes）
//   node scripts/sync-assets.mjs --remote   raw.githubusercontent.com から取得
//   node scripts/sync-assets.mjs --check    コピーせず、同梱済みファイルとマニフェストの整合を検査（CI 用）

import { readFile, writeFile, mkdir, readdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(WEB_DIR, "assets.manifest.json");
const OUT_DIR = path.join(WEB_DIR, "public", "assets", "mch");
const RESTRICTION_SOURCES = ["Data/Heroes/metadata.json", "Data/Extensions/metadata.json"];

const args = new Set(process.argv.slice(2));
const mode = args.has("--check") ? "check" : args.has("--remote") ? "remote" : "local";

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const errors = [];

validateManifest(manifest, errors);
if (errors.length) fail(errors);

if (mode === "check") {
  await check(manifest);
} else {
  await sync(manifest, mode);
}

function validateManifest(m, errs) {
  const seenKeys = new Set();
  const seenPaths = new Set();
  for (const a of m.assets) {
    if (!a.key || !a.type || !a.path) errs.push(`不正なエントリ: ${JSON.stringify(a)}`);
    if (a.type !== "image" && a.type !== "audio") errs.push(`${a.key}: type は image | audio`);
    if (seenKeys.has(a.key)) errs.push(`キー重複: ${a.key}`);
    if (seenPaths.has(a.path)) errs.push(`パス重複: ${a.path}`);
    if (a.path.includes("..") || path.isAbsolute(a.path)) errs.push(`${a.key}: 不正なパス ${a.path}`);
    seenKeys.add(a.key);
    seenPaths.add(a.path);
  }
}

async function check(m) {
  const expected = new Set(m.assets.map((a) => a.path));
  for (const p of expected) {
    if (!(await exists(path.join(OUT_DIR, p)))) errors.push(`未同梱: ${p}（npm run assets:sync を実行）`);
  }
  for (const f of await listFiles(OUT_DIR)) {
    if (!expected.has(f)) errors.push(`マニフェスト外のファイル: ${f}`);
  }
  if (errors.length) fail(errors);
  console.log(`assets:check OK (${expected.size} files)`);
}

async function sync(m, how) {
  const repoDir = path.resolve(WEB_DIR, process.env.MCH_REPO_DIR ?? "../../mycryptoheroes");
  const { repo, ref } = m.source;
  const read = how === "remote"
    ? async (p) => {
        const url = `https://raw.githubusercontent.com/${repo}/${ref}/${p.split("/").map(encodeURIComponent).join("/")}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        return Buffer.from(await res.arrayBuffer());
      }
    : (p) => readFile(path.join(repoDir, p));

  const restricted = new Set();
  for (const src of RESTRICTION_SOURCES) {
    const meta = JSON.parse((await read(src)).toString("utf8"));
    for (const r of meta.restricted_removed_records ?? []) restricted.add(r.image_file_path);
  }
  for (const a of m.assets) {
    if (restricted.has(a.path)) errors.push(`${a.key}: 利用不可（restricted_removed_records）のアセット ${a.path}`);
  }
  if (errors.length) fail(errors);

  await rm(OUT_DIR, { recursive: true, force: true });
  let bytes = 0;
  for (const a of m.assets) {
    const buf = await read(a.path).catch((e) => {
      errors.push(`${a.key}: 取得失敗 ${a.path} (${e.message})`);
      return null;
    });
    if (!buf) continue;
    const dest = path.join(OUT_DIR, a.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    bytes += buf.length;
  }
  if (errors.length) fail(errors);
  console.log(`assets:sync OK (${m.assets.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB, source=${how === "remote" ? `${repo}@${ref}` : repoDir})`);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, base = dir) {
  if (!(await exists(dir))) return [];
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function fail(errs) {
  for (const e of errs) console.error(`✗ ${e}`);
  process.exit(1);
}
