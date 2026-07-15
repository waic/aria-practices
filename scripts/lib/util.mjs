/**
 * ビルドスクリプト共通ユーティリティ。
 */

/**
 * 文字列を正規表現リテラルとして安全に埋め込めるようエスケープする。
 * `*` `?` を含む完全なエスケープ集合。
 * glob 用途では `*` をワイルドカードとして扱うため、エスケープ前に
 * `*` で split し、断片にこの関数を適用すること (rules.mjs 参照)。
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * `{{KEY}}` プレースホルダを vars の値で展開する。
 * 未定義キーは空文字になる。
 */
export function renderTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
