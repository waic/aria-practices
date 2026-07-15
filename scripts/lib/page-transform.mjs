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

function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/**
 * タブナビの <li> 群を生成する。
 * active + aria-current="page" は、タブの href が現在ページ
 * (posixPath: dist 相対 POSIX パス) と完全一致する場合のみ付与する。
 */
function renderTabs(tabs, posixPath, basePath) {
  return tabs
    .map((t) => {
      const attrs =
        t.href === posixPath ? ' class="active" aria-current="page"' : '';
      const href = basePath + t.href;
      return `                <li class="nav__item"><a href="${href}"${attrs}>${t.label}</a></li>`;
    })
    .join('\n');
}

function removeOldStylesheets(html, patterns) {
  for (const pattern of patterns) {
    const re = new RegExp(
      `[ \\t]*<link[^>]*href="[^"]*${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>\\n?`,
      'g'
    );
    html = html.replace(re, '');
  }
  return html;
}

function insertStylesheets(html, stylesheets, basePath) {
  const cssLinks = stylesheets
    .map((s) => `  <link rel="stylesheet" href="${s.replaceAll('{{BASE}}', basePath)}">`)
    .join('\n');
  return html.replace('</head>', `${cssLinks}\n</head>`);
}

function insertNotice(html, notice, isHomeLayout) {
  if (isHomeLayout) {
    // h1 が青カード内にあるため <main> 直後に置く
    return html.replace(/(<main[^>]*>)/, `$1\n${notice}`);
  }
  // 一部の example ページはデモコンテンツ内に <header role="banner"> を含み、
  // </header> 優先だと notice がデモ内部に注入されてしまう。ページタイトルの
  // h1 はデモ用 header より前にあるため、h1 直後を優先する。
  if (/<h1[^>]*>/.test(html)) {
    return html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/, `$1\n${notice}`);
  }
  return html.replace(/(<\/header>)/, `$1\n${notice}`);
}

function removeFeedbackNav(html) {
  return html.replace(/[ \t]*<nav[^>]*class="feedback"[^>]*>[\s\S]*?<\/nav>\n?/, '');
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
  { rule, basePath, posixPath, config, headerTpl, notices }
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
  html = html.replace(/(<body[^>]*>)/, `$1\n${header}`);

  // (g) <main> の id/class を補完し、wrapper で包む (TOC があれば main の前に差し込む)
  html = ensureMainAttributes(html);
  html = html.replace(/(<main\b)/, `<div class="default-grid with-gap leftcol">\n${toc}    $1`);
  html = html.replace('</main>', '</main>\n</div>');

  // (h) <body> に id="top" を保証し、トップに戻るボタンを追加
  html = html.replace(/<body(?![^>]*\bid=)([^>]*)>/, '<body id="top"$1>');
  html = html.replace(
    '</body>',
    `    <a class="button button-backtotop" href="#top"><span>トップに戻る</span></a>\n  </body>`
  );

  return html;
}
