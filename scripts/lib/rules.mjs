/**
 * config.transform のルール解決。
 * キーは dist 相対パス。glob 可 (** = 任意の深さ、* = 1 セグメント内)。
 * 完全一致キーが glob より優先。glob 同士は定義順で先勝ち。
 * 値 null は除外 (変換スキップ)。glob 除外は対象 glob より前に定義すること。
 */

import { escapeRegExp } from './util.mjs';

function globToRegExp(glob) {
  // glob の * はワイルドカードなので、先に * で split してから
  // 残りの断片をエスケープする (escapeRegExp は * ? も含む完全集合)
  const escaped = glob
    .split('**')
    .map((part) => part.split('*').map(escapeRegExp).join('[^/]*'))
    .join('(?:.*)?');
  return new RegExp(`^${escaped}$`);
}

/**
 * transform マップをコンパイルし、相対パス (POSIX 区切り) から
 * ルールを引く resolver を返す。マッチしなければ null。
 */
export function compileRules(transformMap) {
  const exactRules = new Map();
  const globRules = [];
  for (const [key, rule] of Object.entries(transformMap)) {
    if (key.includes('*')) {
      globRules.push({ pattern: globToRegExp(key), rule });
    } else {
      exactRules.set(key, rule);
    }
  }
  return function resolveRule(posixPath) {
    if (exactRules.has(posixPath)) return exactRules.get(posixPath);
    for (const { pattern, rule } of globRules) {
      if (pattern.test(posixPath)) return rule;
    }
    return null;
  };
}
