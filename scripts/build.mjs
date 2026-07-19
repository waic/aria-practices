#!/usr/bin/env node
/**
 * WAIC APG 日本語版 静的ビルダー (エントリポイント)
 *
 * 使い方: node scripts/build.mjs
 * 依存: Node.js 20.12+ (fs.cp / readdir recursive / Dirent.parentPath を使用)。npm install 不要。
 *
 * 動作:
 *   1. dist/ を空にする
 *   2. content/** をそのまま dist/ にコピー (upstream 素材 + 翻訳)
 *   3. waic/overlays/** で dist/ の該当ファイルを上書き (upstream に無い WAIC 独自ファイル用)
 *   4. waic/assets/** を dist/shared/ にマージ
 *   5. waic/config.json の transform にマッチする HTML を変換して書き戻す
 *
 * 変換の内訳:
 *   - 共通処理 (CSS 差し替え / ヘッダー / お知らせ / TOC 等): lib/page-transform.mjs
 *   - apg-home 特有の DOM 変換 (homeLayout: true):            lib/home-layout.mjs
 *   - ルール解決 (完全一致 > glob):                            lib/rules.mjs
 */
import { readFile, writeFile, cp, readdir, rm, mkdir, rmdir } from 'node:fs/promises';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRules } from './lib/rules.mjs';
import { transformPage } from './lib/page-transform.mjs';
import { transformHomeLayout } from './lib/home-layout.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'content');
const WAIC = join(ROOT, 'waic');
const OVERLAYS = join(WAIC, 'overlays');
const PARTIALS = join(WAIC, 'partials');
const ASSETS = join(WAIC, 'assets');
const DIST = join(ROOT, 'dist');

const config = JSON.parse(await readFile(join(WAIC, 'config.json'), 'utf8'));
const resolveRule = compileRules(config.transform);

// ---- ステップ 1: dist をクリーン
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// ---- ステップ 2: content/** を dist/ にコピー
await cp(CONTENT, DIST, { recursive: true });

// ---- ステップ 3: waic/overlays/** で上書き (存在すれば)
try {
  await cp(OVERLAYS, DIST, { recursive: true, force: true });
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

// ---- ステップ 4: waic/assets/** を dist/shared/ にマージ
try {
  await cp(ASSETS, join(DIST, 'shared'), { recursive: true, force: true });
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}

// ---- ステップ 5: partials を読み込み
const headerTpl = await readFile(join(PARTIALS, 'header.html'), 'utf8');
const notices = {};
for (const [name, file] of Object.entries(config.notices || {})) {
  notices[name] = await readFile(join(PARTIALS, file), 'utf8');
}
// upstream の CSR 用テンプレート。ビルド時に h1 直後へ直接注入する。
const readThisFirstTpl = await readFile(
  join(CONTENT, 'shared/templates/read-this-first.html'),
  'utf8'
);

// ---- ステップ 6: 対象 HTML を変換
async function* walkHtml(dir) {
  for (const entry of await readdir(dir, {
    withFileTypes: true,
    recursive: true,
  })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      yield join(entry.parentPath, entry.name);
    }
  }
}

let transformCount = 0;
for await (const absPath of walkHtml(DIST)) {
  const relPath = relative(DIST, absPath);
  const posixPath = relPath.split(sep).join('/');
  const rule = resolveRule(posixPath);
  if (!rule) continue;

  // publishAs があるルールは URL パス直下 (例: patterns/index.html) に出力する。
  // basePath / posixPath (タブ active 判定) は移動先の深さに合わせて計算する。
  const outputRelPath = rule.publishAs || posixPath;
  const depth = outputRelPath.split('/').length - 1;
  const basePath = depth === 0 ? '' : '../'.repeat(depth);

  try {
    let html = await readFile(absPath, 'utf8');
    if (rule.homeLayout) {
      html = transformHomeLayout(html);
    }
    html = transformPage(html, {
      rule,
      basePath,
      posixPath: outputRelPath,
      config,
      headerTpl,
      notices,
      readThisFirstTpl,
    });
    if (rule.publishAs) {
      const outAbs = join(DIST, rule.publishAs);
      if (outAbs !== absPath) {
        await mkdir(dirname(outAbs), { recursive: true });
        await writeFile(outAbs, html);
        await rm(absPath);
      } else {
        await writeFile(outAbs, html);
      }
    } else {
      await writeFile(absPath, html);
    }
    transformCount++;
  } catch (e) {
    console.error(`  ✗ ${posixPath}: ${e.message}`);
    throw e;
  }
}

// 空になった旧ディレクトリ (dist/index/) を掃除する。中身が残っている場合は失敗して残す。
try {
  await rmdir(join(DIST, 'index'));
} catch (e) {
  if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') throw e;
}

console.log(`build complete: dist/ (${transformCount} files transformed)`);
