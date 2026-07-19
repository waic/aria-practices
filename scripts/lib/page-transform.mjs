/**
 * ページ変換 (共通処理)。
 *
 * 1 つの HTML 文字列に対して、config.transform のルールに従い:
 * - 旧スタイルシート (TR base.css / core.css) の <link> を除去
 * - <head> に WAI サイト CSS + apg-overrides.css を挿入
 * - お知らせ枠を挿入 (notice 指定時)
 * - feedback nav (関連する Issues) を除去
 * - TOC サイドバー「このページの内容」を生成 (toc: true 時)
 * - <body> 直後に共通ヘッダー (skip link + minimal-header + タブナビ) を挿入
 * - <main> の id/class を補完し .default-grid.with-gap.leftcol でラップ
 * - トップに戻るボタンを追加
 *
 * apg-home 特有の DOM 変換は home-layout.mjs 側にあり、この前段で適用される。
 */

import { escapeRegExp, renderTemplate } from './util.mjs';

/**
 * 必須アンカーの置換。アンカーが見つからなければ throw する
 * (home-layout.mjs と同様、upstream の構造変化を fail-loud で検知するため)。
 * pattern は文字列 / 正規表現のどちらも可。
 * 任意アンカー (無くても正常なもの) には使わず、素の replace のままにすること。
 */
function replaceOrThrow(html, pattern, replacement, name) {
  const found =
    typeof pattern === 'string' ? html.includes(pattern) : pattern.test(html);
  if (!found) {
    throw new Error(
      `${name} が見つかりません (upstream の構造が変わった可能性があります)`
    );
  }
  return html.replace(pattern, replacement);
}

/**
 * dist 相対パスをタブ href と比較しやすい形に正規化する。
 * `index.html` → `""`、`patterns/index.html` → `"patterns/"` のようにディレクトリ URL 化する。
 */
function normalizeForTab(p) {
  if (p === 'index.html') return '';
  return p.replace(/\/index\.html$/, '/');
}

/**
 * タブナビの <li> 群を生成する。
 * active + aria-current="page" は、タブの href (ディレクトリ URL) が
 * 現在ページを正規化した値と一致する場合のみ付与する。
 */
function renderTabs(tabs, posixPath, basePath) {
  const normalized = normalizeForTab(posixPath);
  return tabs
    .map((t) => {
      const attrs =
        t.href === normalized ? ' class="active" aria-current="page"' : '';
      const href = basePath + t.href;
      return `                <li class="nav__item"><a href="${href}"${attrs}>${t.label}</a></li>`;
    })
    .join('\n');
}

function removeOldStylesheets(html, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(
      `[ \\t]*<link[^>]*href="[^"]*${escapeRegExp(pattern)}[^"]*"[^>]*>\\n?`,
      'g'
    );
    html = html.replace(re, '');
  }
  return html;
}

function insertStylesheets(html, stylesheets, basePath) {
  const cssLinks = stylesheets
    .map((s) => `  <link rel="stylesheet" href="${renderTemplate(s, { BASE: basePath })}">`)
    .join('\n');
  return replaceOrThrow(html, '</head>', `${cssLinks}\n</head>`, '</head>');
}

function insertNotice(html, notice, isHomeLayout) {
  if (isHomeLayout) {
    // h1 が青カード内にあるため <main> 直後に置く
    return replaceOrThrow(
      html,
      /(<main[^>]*>)/,
      `$1\n${notice}`,
      'notice 挿入先の <main>'
    );
  }
  // 一部の example ページはデモコンテンツ内に <header role="banner"> を含み、
  // </header> 優先だと notice がデモ内部に注入されてしまう。ページタイトルの
  // h1 はデモ用 header より前にあるため、h1 直後を優先する。
  if (/<h1[^>]*>/.test(html)) {
    return replaceOrThrow(
      html,
      /(<h1[^>]*>[\s\S]*?<\/h1>)/,
      `$1\n${notice}`,
      'notice 挿入先の h1'
    );
  }
  return replaceOrThrow(
    html,
    /(<\/header>)/,
    `$1\n${notice}`,
    'notice 挿入先の h1 / </header>'
  );
}

/**
 * タブ 5 ページを URL パス直下の index.html に配置したことに合わせ、
 * ページ内の旧ファイル名参照をディレクトリ URL に書き換える。
 * basePath 相対プレフィックスを保った状態で末尾のファイル名部分のみ置換する。
 */
function rewriteInternalLinks(html) {
  return html
    .replaceAll('apg-home.html', './')
    .replaceAll('patterns/patterns.html', 'patterns/')
    .replaceAll('practices/practices.html', 'practices/')
    .replaceAll('about/about.html', 'about/')
    .replaceAll('index/index.html', 'example-index/');
}

function removeFeedbackNav(html) {
  return html.replace(/[ \t]*<nav[^>]*class="feedback"[^>]*>[\s\S]*?<\/nav>\n?/, '');
}

/**
 * upstream の "Read This First" バナー (`<script data-read-this-first ...>` で CSR 挿入される)
 * をビルド時に直接埋め込む。
 * - script タグを検知し、あれば除去する
 * - template の <body> 内 (`<div class="read-this-first">...`) を取り出し、
 *   相対パス `../../` を basePath に置換して h1 直後に挿入する
 * script タグが無ければ何もしない。upstream での有無 (patterns / practices など) が
 * そのままトリガになるので、upstream 追従時に config を触らずに済む。
 */
function insertReadThisFirst(html, tpl, basePath) {
  const scriptRe = /[ \t]*<script[^>]*\bdata-read-this-first\b[^>]*>\s*<\/script>\n?/;
  if (!scriptRe.test(html)) return html;
  const bodyMatch = tpl.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!bodyMatch) {
    throw new Error(
      'read-this-first テンプレートに <body> が見つかりません (upstream の構造が変わった可能性があります)'
    );
  }
  const banner = bodyMatch[1].trim().replace(/\.\.\/\.\.\//g, basePath);
  html = html.replace(scriptRe, '');
  return replaceOrThrow(
    html,
    /(<h1[^>]*>[\s\S]*?<\/h1>)/,
    `$1\n${banner}`,
    'read-this-first 挿入先の h1'
  );
}

/**
 * id の無い h2 に見出しテキスト由来の id を付与し、
 * 「このページの内容」サイドバーの HTML を生成する。
 * 戻り値: { html, toc } (toc は h2 が無ければ空文字)
 */
function buildToc(html) {
  const usedIds = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  );
  // 1 パス目: id の無い h2 に id を付与
  html = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (m, attrs, inner) => {
    if (/\bid="/.test(attrs)) return m;
    const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) return m;
    // 空白と記号を除去、日本語はそのまま (日本語 id は HTML 上有効)
    const base = text.replace(/[\s、。・．，()（）:：]+/g, '') || 'section';
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
  if (entries.length === 0) return { html, toc: '' };

  const items = entries
    .map((e) => `          <li><a href="#${e.id}">${e.text}</a></li>`)
    .join('\n');
  const toc = `    <nav class="box nav-hack sidebar standalone-resource__sidebar" aria-labelledby="sidebar-header">
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
  return { html, toc };
}

function ensureMainAttributes(html) {
  return html.replace(/<main([^>]*)>/, (m, attrs) => {
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
}

/**
 * ページ変換のメインエントリ。
 * @param html 変換対象の HTML
 * @param ctx  { rule, basePath, posixPath, config, headerTpl, notices }
 */
export function transformPage(
  html,
  { rule, basePath, posixPath, config, headerTpl, notices, readThisFirstTpl }
) {
  // (a) 旧スタイルシートの除去と WAI CSS の挿入
  html = removeOldStylesheets(html, config.removeStylesheets || []);
  html = insertStylesheets(
    html,
    [...config.stylesheets, ...(rule.extraStylesheets || [])],
    basePath
  );

  // (b) お知らせ枠 (共通ヘッダーより先に処理し、site-header の </header> への誤マッチを防ぐ)
  if (rule.notice && notices[rule.notice]) {
    const notice = renderTemplate(notices[rule.notice], { BASE: basePath });
    html = insertNotice(html, notice, !!rule.homeLayout);
  }

  // (c) feedback nav の除去 (本家ビルドと同様)
  html = removeFeedbackNav(html);

  // (c') Read This First バナーをビルド時に埋め込む (upstream の CSR を置き換え)
  if (readThisFirstTpl) {
    html = insertReadThisFirst(html, readThisFirstTpl, basePath);
  }

  // (d) TOC サイドバー (共通ヘッダー挿入前に行い、ヘッダー由来の h2 を拾わないようにする)
  let toc = '';
  if (rule.toc) {
    ({ html, toc } = buildToc(html));
  }

  // (e) <main> が無いページ (patterns.html / practices.html 等の一覧ページ) は
  //     body 内容全体を <main> で包み、main ランドマークとスキップリンクの
  //     飛び先 (ensureMainAttributes が id="main" を補完) を確保する。
  //     共通ヘッダーを main の外に置くため、ヘッダー挿入より前に行う。
  if (!/<main\b/.test(html)) {
    html = html.replace(
      /(<body[^>]*>)([\s\S]*?)(<\/body>)/,
      '$1\n<main>$2</main>\n$3'
    );
  }

  // (f) <body> 直後に共通ヘッダーを挿入
  const header = renderTemplate(headerTpl, {
    BASE: basePath,
    TABS: renderTabs(config.tabs, posixPath, basePath),
  });
  html = replaceOrThrow(html, /(<body[^>]*>)/, `$1\n${header}`, '<body>');

  // (g) <main> の id/class を補完し、wrapper で包む (TOC があれば main の前に差し込む)
  html = ensureMainAttributes(html);
  html = replaceOrThrow(
    html,
    /(<main\b)/,
    `<div class="default-grid with-gap leftcol">\n${toc}    $1`,
    '<main>'
  );
  html = replaceOrThrow(html, '</main>', '</main>\n</div>', '</main>');

  // (h) <body> に id="top" を保証し、トップに戻るボタンを追加
  //     (id="top" 付与はマッチしない場合「既に id がある」正常系なので素の replace のまま)
  html = html.replace(/<body(?![^>]*\bid=)([^>]*)>/, '<body id="top"$1>');

  // (i) 旧タブページのファイル名参照をディレクトリ URL に書き換える
  html = rewriteInternalLinks(html);

  html = replaceOrThrow(
    html,
    '</body>',
    `    <a class="button button-backtotop" href="#top"><span>トップに戻る</span></a>\n  </body>`,
    '</body>'
  );

  return html;
}
