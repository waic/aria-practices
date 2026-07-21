/**
 * apg-home.html 専用の DOM 変換。
 *
 * content/apg-home.html は wai-aria-practices (Jekyll) が変換する前提の素材
 * (div#top-card / #resources / #collaboration) であり、そのままでは
 * homepage.css が効かない。この変換で素材から各要素 (h1 / p / a / img / li 群)
 * を抽出し、本家 https://www.w3.org/WAI/ARIA/apg/ と同じレンダリング済み DOM
 * (off-white-section / top-box / resource-item / collaboration-item /
 * mailing-list-item) を生成する。
 *
 * upstream で apg-home の構造が変わると抽出に失敗して throw する
 * (レイアウト追従が必要になった合図)。
 */

function get(re, src, name) {
  const m = src.match(re);
  if (!m) {
    throw new Error(
      `homeLayout: ${name} の抽出に失敗しました (upstream の apg-home 構造が変わった可能性があります)`
    );
  }
  return m;
}

function getItems(src, name) {
  const items = [...src.matchAll(/<li>\s*([\s\S]*?)\s*<\/li>/g)];
  if (items.length === 0) {
    throw new Error(`homeLayout: ${name} の <li> が見つかりません`);
  }
  return items.map((m) => m[1]);
}

export function transformHomeLayout(html) {
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
  return html.replace(/(<body[^>]*>)[\s\S]*<\/body>/, `$1\n${body}\n</body>`);
}
