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

/**
 * apg-home.html の Jekyll 用素材構造 (div#top-card / #resources / #collaboration) を、
 * 本家 https://www.w3.org/WAI/ARIA/apg/ のレンダリング済み構造に変換する。
 * homepage.css が期待するクラス名 (off-white-section / top-box / resource-item /
 * collaboration-item 等) の DOM を生成する。
 * upstream で apg-home の構造が変わると抽出に失敗して throw する (追従が必要になった合図)。
 */
function transformHomeLayout(html) {
  const get = (re, src, name) => {
    const m = src.match(re);
    if (!m) {
      throw new Error(
        `homeLayout: ${name} の抽出に失敗しました (upstream の apg-home 構造が変わった可能性があります)`
      );
    }
    return m;
  };
  const getItems = (src, name) => {
    const items = [...src.matchAll(/<li>\s*([\s\S]*?)\s*<\/li>/g)];
    if (items.length === 0) {
      throw new Error(`homeLayout: ${name} の <li> が見つかりません`);
    }
    return items.map((m) => m[1]);
  };

  // --- セクション抽出
  const topCard = get(
    /<div id="top-card">([\s\S]*?)<\/div>\s*<div id="resources">/,
    html,
    'top-card'
  )[1];
  const resources = get(
    /<div id="resources">([\s\S]*?)<\/div>\s*<div id="collaboration">/,
    html,
    'resources'
  )[1];
  const collaboration = get(
    /<div id="collaboration">([\s\S]*?)<\/ul>\s*<\/div>/,
    html,
    'collaboration'
  )[1];

  // --- top-card
  const topH1 = get(/<h1[^>]*>([\s\S]*?)<\/h1>/, topCard, 'top-card の h1')[1];
  const topP = get(/<p>([\s\S]*?)<\/p>/, topCard, 'top-card の p')[1];
  const topA = get(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/, topCard, 'top-card の a');
  const topImg = get(/<img[^>]*>/, topCard, 'top-card の img')[0];

  // --- resources
  const resH2 = get(/<h2[^>]*>([\s\S]*?)<\/h2>/, resources, 'resources の h2')[1];
  const resP = get(/<h2[^>]*>[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/, resources, 'resources の p')[1];
  const resourceItems = getItems(resources, 'resources').map((li, i) => {
    const h3 = get(/<h3>([\s\S]*?)<\/h3>/, li, `resources li[${i}] の h3`)[1];
    const p = get(/<p>([\s\S]*?)<\/p>/, li, `resources li[${i}] の p`)[1];
    const a = get(/<a ([^>]*)>([\s\S]*?)<\/a>/, li, `resources li[${i}] の a`);
    const img = get(/<img[^>]*>/, li, `resources li[${i}] の img`)[0];
    const aAttrs = a[1].includes('class=')
      ? a[1]
      : `${a[1]} class="button-link"`;
    return `        <div class="resource-item">
          <div class="resource-item-content">
            <h3>${h3}</h3>
            <p>${p}</p>
            <a ${aAttrs}>${a[2]}</a>
          </div>
          <div class="resource-item-img">
            ${img}
          </div>
        </div>`;
  });

  // --- collaboration (最後の li は mailing-list-item として構造が異なる)
  const colH2 = get(/<h2[^>]*>([\s\S]*?)<\/h2>/, collaboration, 'collaboration の h2')[1];
  const colP = get(
    /<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/,
    collaboration,
    'collaboration の p'
  )[1];
  const colLis = getItems(collaboration, 'collaboration');
  const colItems = colLis.map((li, i) => {
    const h3 = get(/<h3>([\s\S]*?)<\/h3>/, li, `collaboration li[${i}] の h3`)[1];
    const img = get(/<img[^>]*>/, li, `collaboration li[${i}] の img`)[0];
    const isLast = i === colLis.length - 1;
    if (isLast) {
      // Mailing Lists: p が複数 (本文 + リンク行)
      const ps = [...li.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[0]);
      return `        <div class="collaboration-item mailing-list-item">
          <div class="collaboration-detail-4 detail-4"></div>
          ${img}
          <div>
            <h3>${h3}</h3>
            ${ps.join('\n            ')}
          </div>
        </div>`;
    }
    const p = get(/<p>([\s\S]*?)<\/p>/, li, `collaboration li[${i}] の p`)[1];
    const a = get(/<a ([^>]*)>([\s\S]*?)<\/a>/, li, `collaboration li[${i}] の a`);
    return `        <div class="collaboration-item">
          ${img}
          <h3>${h3}</h3>
          <p>${p}</p>
          <a ${a[1]}>${a[2]}</a>
        </div>`;
  });

  // --- head 内の素材用 <style> (img { max-width: 300px } 等) を除去
  html = html.replace(/[ \t]*<style>[\s\S]*?<\/style>\n?/, '');

  // --- body を本家レンダリング構造で置換
  const body = `
    <main id="main" class="standalone-resource__main">
<div>
    <div class="off-white-section">
      <div class="contained top-contained margin-fix">
        <div class="top-section">
          <div class="top-box">
            <div class="top-detail-1 detail-1"></div>
            <div class="detail-2"></div>
            <h1>${topH1}</h1>
            <p>${topP}</p>
            <a href="${topA[1]}" class="button-link button-link-white">${topA[2]}</a>
          </div>
          ${topImg}
        </div>
      </div>
      <div class="detail-3"></div>
      <div class="top-grid-pattern grid-pattern"></div>
    </div>
    <div class="white-section">
      <div class="centered">
        <div class="resource-detail-4 detail-4"></div>
        <h2>${resH2}</h2>
        <p>${resP}</p>
      </div>
      <div class="contained margin-fix">
${resourceItems.join('\n')}
      </div>
      <div class="collaboration-grid-pattern grid-pattern"></div>
    </div>
    <div class="white-section">
      <div class="centered margin-fix">
        <h2 class="collaboration-h2">${colH2}</h2>
        <p class="collaboration-p">${colP}</p>
      </div>
      <div class="collaboration-items">
${colItems.join('\n')}
      </div>
      <div class="bottom-grid-pattern grid-pattern"></div>
    </div>
    <div class="bottom-off-white-section off-white-section"></div>
</div>
    </main>
  `;
  html = html.replace(/(<body[^>]*>)[\s\S]*<\/body>/, `$1\n${body}\n</body>`);
  return html;
}

async function transformHtml(relPath, rule) {
  const abs = join(DIST, relPath);
  let html = await readFile(abs, 'utf8');
  const basePath = computeBasePath(relPath);

  // (a0) apg-home: Jekyll 用素材構造を本家レンダリング構造に変換
  if (rule.homeLayout) {
    html = transformHomeLayout(html);
  }

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

  // (c) お知らせ枠を挿入
  //    - homeLayout ページ: <main> 直後 (h1 は青カード内にあるため)
  //    - それ以外: <h1>...</header> または <h1>...</h1> の直後
  //    共通ヘッダー (site-header も </header> を持つ) より先に処理して誤マッチを防ぐ
  if (rule.notice && notices[rule.notice]) {
    const notice = renderTemplate(notices[rule.notice], { BASE: basePath });
    if (rule.homeLayout) {
      html = html.replace(/(<main[^>]*>)/, `$1\n${notice}`);
    } else if (/<\/header>\s*/.test(html)) {
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
