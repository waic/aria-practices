/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 *
 * ARIA Combobox Examples
 */

'use strict';

var aria = aria || {};

var FRUITS_AND_VEGGIES = [
  ['リンゴ', '果物'],
  ['アーティチョーク', '野菜'],
  ['アスパラガス', '野菜'],
  ['バナナ', '果物'],
  ['ビート', '野菜'],
  ['ピーマン', '野菜'],
  ['ブロッコリー', '野菜'],
  ['メキャベツ', '野菜'],
  ['キャベツ', '野菜'],
  ['ニンジン', '野菜'],
  ['カリフラワー', '野菜'],
  ['セロリ', '野菜'],
  ['チャード', '野菜'],
  ['チコリ', '野菜'],
  ['トウモロコシ', '野菜'],
  ['キュウリ', '野菜'],
  ['ダイコン', '野菜'],
  ['デーツ', '果物'],
  ['エダマメ', '野菜'],
  ['ナス', '野菜'],
  ['エルダーベリー', '果物'],
  ['フェンネル', '野菜'],
  ['イチジク', '果物'],
  ['ニンニク', '野菜'],
  ['ブドウ', '果物'],
  ['ハネデューメロン', '果物'],
  ['アイスバーグレタス', '野菜'],
  ['エルサレムアーティチョーク', '野菜'],
  ['ケール', '野菜'],
  ['キウイ', '果物'],
  ['リーク', '野菜'],
  ['レモン', '果物'],
  ['マンゴー', '果物'],
  ['マンゴスチン', '果物'],
  ['メロン', '果物'],
  ['キノコ', '菌類'],
  ['ネクタリン', '果物'],
  ['オクラ', '野菜'],
  ['オリーブ', '野菜'],
  ['タマネギ', '野菜'],
  ['オレンジ', '果物'],
  ['パースニップ', '野菜'],
  ['エンドウ', '野菜'],
  ['ナシ', '果物'],
  ['パイナップル', '果物'],
  ['ジャガイモ', '野菜'],
  ['カボチャ', '果物'],
  ['マルメロ', '果物'],
  ['ラディッシュ', '野菜'],
  ['ルバーブ', '野菜'],
  ['エシャロット', '野菜'],
  ['ホウレンソウ', '野菜'],
  ['カボチャ', '野菜'],
  ['イチゴ', '果物'],
  ['サツマイモ', '野菜'],
  ['トマト', '果物'],
  ['カブ', '野菜'],
  ['ウグリフルーツ', '果物'],
  ['ビクトリアプラム', '果物'],
  ['クレソン', '野菜'],
  ['スイカ', '果物'],
  ['ヤム', '野菜'],
  ['ズッキーニ', '野菜'],
].sort((a, b) => a[0].localeCompare(b[0])); // 配列リテラルをあいうえお順に並び替えると原文との対応が失われるため、sort()を使用

function searchVeggies(searchString) {
  var results = [];

  for (var i = 0; i < FRUITS_AND_VEGGIES.length; i++) {
    var veggie = FRUITS_AND_VEGGIES[i][0].toLowerCase();
    if (veggie.indexOf(searchString.toLowerCase()) === 0) {
      results.push(FRUITS_AND_VEGGIES[i]);
    }
  }

  return results;
}

/**
 * @function onload
 * @description Initialize the combobox examples once the page has loaded
 */
window.addEventListener('load', function () {
  new aria.GridCombobox(
    document.getElementById('ex1-input'),
    document.getElementById('ex1-grid'),
    searchVeggies
  );
});
