#!/usr/bin/env node
/**
 * WAIC APG 日本語版 静的ビルダー
 *
 * 動作:
 *   1. dist/ を空にする
 *   2. content/** をそのまま dist/ にコピー (upstream 素材)
 *   3. waic/overlays/** で dist/ の該当ファイルを上書き
 *   4. waic/assets/** を dist/shared/ にマージ
 *   5. waic/config.json の transform にマッチする HTML について:
 *      - 旧スタイルシート (TR base.css / core.css) の <link> を除去
 *      - <head> に WAI サイト CSS + apg-overrides.css を追加
 *      - <body> 直後に共通ヘッダー (skip link + minimal-header + タブナビ) を挿入
 *      - <main> の id/class を補完し .default-grid.with-gap.leftcol でラップ
 *      - <h1>...</header> の直後に日本語版のお知らせ枠を挿入 (指定時のみ)
 *      - </body> 直前にトップに戻るボタンを追加
 *
 * transform のキーは相対パス。glob 可 (** = 任意の深さ、* = 1 セグメント内)。
 * 完全一致キーが glob より優先。glob 同士は定義順で先勝ち。
 *
 * 依存: Node.js 20+ (fs.cp / readdir recursive を使用)。npm install 不要。
 */
import { readFile, writeFile, cp, readdir, rm, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'content');
const WAIC = join(ROOT, 'waic');
const OVERLAYS = join(WAIC, 'overlays');
const PARTIALS = join(WAIC, 'partials');
const ASSETS = join(WAIC, 'assets');
const DIST = join(ROOT, 'dist');
const CONFIG = JSON.parse(await readFile(join(WAIC, 'config.json'), 'utf8'));

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
for (const [name] of Object.entries(CONFIG.notices || {})) {
  notices[name] = await readFile(join(PARTIALS, CONFIG.notices[name]), 'utf8');
}

// ---- glob マッチャー: ** = 任意の深さ、* = 1 セグメント内の任意文字列
function globToRegExp(glob) {
  const escaped = glob
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*')
    )
    .join('(?:.*)?');
  return new RegExp(`^${escaped}$`);
}

const exactRules = new Map();
const globRules = [];
for (const [key, rule] of Object.entries(CONFIG.transform)) {
  if (key.includes('*')) {
    globRules.push({ pattern: globToRegExp(key), source: key, rule });
  } else {
    exactRules.set(key, rule);
  }
}

function resolveRule(relPath) {
  const posixPath = relPath.split(sep).join('/');
  if (exactRules.has(posixPath)) return exactRules.get(posixPath);
  for (const { pattern, rule } of globRules) {
    if (pattern.test(posixPath)) return rule;
  }
  return null;
}

// ---- ステップ 6: 対象 HTML を変換
function computeBasePath(relPath) {
  const depth = relPath.split(sep).length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function renderTabs(activeTab, basePath) {
  return CONFIG.tabs
    .map((t) => {
      const attrs =
        t.key === activeTab ? ' class="active" aria-current="page"' : '';
      const href = basePath + t.href;
      return `                <li class="nav__item"><a href="${href}"${attrs}>${t.label}</a></li>`;
    })
    .join('\n');
}

async function transformHtml(relPath, rule) {
  const abs = join(DIST, relPath);
  let html = await readFile(abs, 'utf8');
  const basePath = computeBasePath(relPath);

  // (a) 旧スタイルシートの <link> を除去 (本家ビルドと同様に styles.css へ置換)
  for (const pattern of CONFIG.removeStylesheets || []) {
    const re = new RegExp(
      `[ \\t]*<link[^>]*href="[^"]*${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>\\n?`,
      'g'
    );
    html = html.replace(re, '');
  }

  // (b) <head> に CSS を追加 (共通 + ページ個別)
  const cssLinks = [...CONFIG.stylesheets, ...(rule.extraStylesheets || [])]
    .map((s) => `  <link rel="stylesheet" href="${s.replaceAll('{{BASE}}', basePath)}">`)
    .join('\n');
  html = html.replace('</head>', `${cssLinks}\n</head>`);

  // (c) お知らせ枠を <h1>...</header> または <h1>...</h1> の直後に挿入
  //    共通ヘッダー (site-header も </header> を持つ) より先に処理して誤マッチを防ぐ
  if (rule.notice && notices[rule.notice]) {
    const notice = renderTemplate(notices[rule.notice], { BASE: basePath });
    if (/<\/header>\s*/.test(html)) {
      html = html.replace(/(<\/header>)/, `$1\n${notice}`);
    } else {
      html = html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/, `$1\n${notice}`);
    }
  }

  // (c2) feedback nav (関連する Issues / デザインパターン) を除去 (本家ビルドと同様)
  html = html.replace(/[ \t]*<nav[^>]*class="feedback"[^>]*>[\s\S]*?<\/nav>\n?/, '');

  // (c3) TOC サイドバー: h2 に id を補完し、「このページの内容」ナビを生成
  //     (共通ヘッダー挿入前に行い、ヘッダー由来の h2 を拾わないようにする)
  let toc = '';
  if (rule.toc) {
    const usedIds = new Set(
      [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
    );
    // 1 パス目: id の無い h2 に見出しテキスト由来の id を付与
    html = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
      if (/\bid="/.test(attrs)) return m;
      const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!text) return m;
      // 空白と記号を除去、日本語はそのまま (日本語 id は HTML 上有効)
      const base =
        text.replace(/[\s、。・．，()（）:：]+/g, '') || 'section';
      let id = base;
      let n = 2;
      while (usedIds.has(id)) id = `${base}-${n++}`;
      usedIds.add(id);
      return `<h2 id="${id}"${attrs}>${inner}</h2>`;
    });
    // 2 パス目: id 付き h2 をすべて収集
    const entries = [];
    for (const m of html.matchAll(/<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
      const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) entries.push({ id: m[1], text });
    }
    if (entries.length > 0) {
      const items = entries
        .map((e) => `          <li><a href="#${e.id}">${e.text}</a></li>`)
        .join('\n');
      toc = `    <nav class="box nav-hack sidebar standalone-resource__sidebar" aria-labelledby="sidebar-header">
      <h2 id="sidebar-header" class="box-h">このページの内容</h2>
      <div class="box-i">
        <ul>
${items}
        </ul>
      </div>
    </nav>\n`;
      // body に has-sidebar クラスを付与 (グリッド配置用)
      html = html.replace(/<body([^>]*)class="([^"]*)"/, '<body$1class="$2 has-sidebar"');
      if (!/<body[^>]*class=/.test(html)) {
        html = html.replace(/<body([^>]*)>/, '<body$1 class="has-sidebar">');
      }
    }
  }

  // (d) <body ...> 直後に共通ヘッダーを挿入
  const header = renderTemplate(headerTpl, {
    BASE: basePath,
    TABS: renderTabs(rule.activeTab, basePath),
  });
  html = html.replace(/(<body[^>]*>)/, `$1\n${header}`);

  // (e) <main> に id="main" (skip link 用) と standalone-resource__main (グリッド配置用) を保証
  html = html.replace(/<main([^>]*)>/, (m, attrs) => {
    let a = attrs;
    if (!/\bid=/.test(a)) a += ' id="main"';
    if (/\bclass="/.test(a)) {
      if (!a.includes('standalone-resource__main')) {
        a = a.replace(/class="/, 'class="standalone-resource__main ');
      }
    } else {
      a += ' class="standalone-resource__main"';
    }
    return `<main${a}>`;
  });

  // (f) <main> を wrapper で包む (TOC があれば main の前に差し込む)
  //    <main の直前に開始タグ、</main> の直後に終了タグを差し込む
  html = html.replace(/(<main\b)/, `<div class="default-grid with-gap leftcol">\n${toc}    $1`);
  html = html.replace('</main>', '</main>\n</div>');

  // (g) <body> に id="top" (トップに戻る用) を保証し、</body> 直前にボタンを追加
  html = html.replace(/<body(?![^>]*\bid=)([^>]*)>/, '<body id="top"$1>');
  html = html.replace(
    '</body>',
    `    <a class="button button-backtotop" href="#top"><span>トップに戻る</span></a>\n  </body>`
  );

  await writeFile(abs, html);
}

// dist/ 内の全 HTML を走査し、ルールにマッチしたものを変換
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
  const rule = resolveRule(relPath);
  if (!rule) continue;
  try {
    await transformHtml(relPath, rule);
    transformCount++;
  } catch (e) {
    console.error(`  ✗ ${relPath}: ${e.message}`);
    throw e;
  }
}

console.log(`build complete: dist/ (${transformCount} files transformed)`);
