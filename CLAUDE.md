# 作業説明

W3C の [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) の日本語訳プロジェクトです。あなたはアクセシビリティの専門家であり、英日翻訳のプロとして、`./content/patterns` 配下の HTML の title 要素、及び body 要素内のすべてのテキストを日本語に翻訳します。

## 翻訳対象

`./content/patterns` ディレクトリの配下が対象です。パターンごとに、パターン名のディレクトリが切られています。以下のファイルを全て翻訳してください。

- `<pattern-name>-pattern.html`
- `examples/<example-name>.html`

ただし、`<html lang="ja">` の指定があるファイルは翻訳済みですので、作業不要です。

HTML だけを翻訳してください。他のファイルは触れないでください。ファイルは直接編集してください。

## 作業の流れ

作業者の指示に従って翻訳作業を行ってください。TODO リストが提供された場合はそれに従ってください。ステップごとにチェックリストになっています。各ステップを実施し、それが完了したらチェックを入れて（ファイルを編集して）ください。

**IMPORTANT**: コミットメッセージは必ず日本語で記述してください。

## 制約条件

### 敬体（ですます調）で翻訳する

翻訳文は敬体（ですます調）で記述してください。

### 原文に忠実に

原文にない文章を勝手に追加したり、削除したりしてはいけません。

### 同一文には同じ訳文を適用する

APG の特性上、別ファイル間で同一の英文が登場することがあります。その場合、同一の英文には同一の訳文を適用してください。

### 構造を省略・変更しない

SVG やテーブル、リンク、リスト、画像などの HTML タグや構造は**すべて維持してそのまま**翻訳してください。改行も可能な限り維持してください。これらの**省略や変更は一切認めません**。

### 可能な限り、逐語訳を行う

ただし、逐語訳では日本語で意味を取りづらい場合は、原文のニュアンスを損なわない範囲で、語を補ったり、順序を調整したり、意訳をしたりしてもかまいません。

### コンテンツのみを翻訳し、タグや属性は変更しない

例外として、`lang` 属性は適切に書き換え、`aria-label` 属性、`aria-roledescription` 属性は翻訳してください。

### Web 開発における標準的な語彙を選択する

たとえば "alert" を「警告」ではなく「アラート」と訳してください。

### 全角文字と半角文字の間には半角スペースを入れる

ただし、記号と半角文字の間は不要です。

例: `これはHTMLです。` → `これは HTML です。`

### aria-label の "Start of" / "End of" の訳

`aria-label` の "Start of" と "End of" はそれぞれ「の開始」「の終了」と翻訳します。また、日本語では語順が逆になるため、`aria-labelledby` に指定されている id の順序も入れ替えてください。

原文:

```html
<div
  role="separator"
  id="ex_start_sep"
  aria-labelledby="ex_start_sep ex_label"
  aria-label="Start of"
></div>
```

訳文（`aria-labelledby` の id 順序も入れ替える）:

```html
<div
  role="separator"
  id="ex_start_sep"
  aria-labelledby="ex_label ex_start_sep"
  aria-label="の開始"
></div>
```

### RFC 2119 キーワードの訳

- must : しなければならない
- must not : してはならない
- should : すべきである
- should not : すべきでない
- recommended : 推奨される
- may : してもよい

## 用語集

以下の翻訳例を優先的に用いてください。フォーマット:

```
- {原文または避けたい言い回し。カンマ(,)区切りで複数指定可} : {使用する訳文}
```

### 見出し・共通

- Accessibility Features : アクセシビリティ機能
- Keyboard Support : キーボードのサポート
- JavaScript and CSS Source Code : JavaScript 及び CSS のソースコード
- HTML Source Code : HTML のソースコード

### 一般用語

- role : ロール
- activates the button : ボタンを作動する
- area : 領域
- assistive technology,AT,assistive technologies : 支援技術
- related issues : 関連する Issues
- tabindex : tabindex
- technique : テクニック
- author : コンテンツ制作者
- user : 利用者
- user agent : ユーザエージェント
- gesture : ジェスチャ
- version : 版
- dexterity \*\*\* : 巧緻性 ○○
- \*\*\* with disabilities : 障害のある ○○
- web : ウェブ
- identify : 特定する
- spacebar,space bar,spacekey,space key : スペースキー
- server : サーバー
- drag and drop,drag-and-drop : ドラッグ＆ドロップ
- supersede : 置き換える
- acceptance criteria : 受け入れ基準
- dot release : ドットリリース
- trigger,trigger stimulus : トリガ
- Sufficient Techniques : 十分な達成方法
- advisory techniques : 参考達成方法
- Failure : 失敗例
- text alternative : テキストによる代替
- media alternative : メディアによる代替
- activity : 操作
- defining instance : 定義実体
- (and encouraged) : (そして推奨される)
- low vision : ロービジョン
- path-based : 軌跡ベースの
- section : セクション
- subsection : サブセクション
- note : 注記
- success criterion : 達成基準
- option(s) : 選択肢

### 表記統一（避けたい言い回し → 望ましい表記）

- または : 又は
- および : 及び
- 読みかた : 読み方
- することができます : できます

### radiobutton / checkbox 特有

- checkbox（ドキュメント本文・UI 操作表示）
  - 動詞: check → 「チェックする」
  - 動詞（反対）: uncheck → 「チェックを外す」
  - 状態（過去分詞的）: checked → 「チェック済み / チェックされている」
  - 状態（否定）: unchecked → 「未チェック / チェックされていない」
- radio（ドキュメント本文・状態説明）
  - 動詞: check → 「選択する」（操作指示で短くする場合は「チェックする」も可）
  - 動詞（反対）: uncheck → 「選択を解除する」（同「チェックを外す」も可）
  - 状態: checked → 「選択済み」（説明で「チェックされている」も可）
  - 状態（否定）: unchecked → 「未選択」（説明で「チェックされていない」も可）
- 技術用語（属性・プロパティ）
  - `checked` 属性／`checked` プロパティ：訳語はそのまま併記（例: 「`checked` 属性（チェック済みを示す）」）し、本文では「チェックされている／選択されている」と説明。

## 翻訳作業が完了したら

翻訳作業が完了したら、以下のチェックを必ず実行してください。

検証には [waic-wg4-tools](https://github.com/ef81sp/waic-wg4-tools) を使います。`pnpm dlx` で取得・実行できます。

### 用語・記法チェック（textlint）

```
pnpm dlx github:ef81sp/waic-wg4-tools lint <dir> --fix
```

`<dir>` には、翻訳したディレクトリのパスを指定してください。例:

```
pnpm dlx github:ef81sp/waic-wg4-tools lint content
```

- textlint のエラーのうち「error 同義語である「月」と「月曜」が利用されています @textlint-ja/no-synonyms」に限っては無視して構いません。
- 「✓ {number} fixable problem.」のようなメッセージが出た場合は、`pnpm dlx github:ef81sp/waic-wg4-tools lint content/patterns/<pattern-name>/ --fix` を実行して自動修正を行ってください。

### 表記揺れチェック

```
pnpm dlx github:ef81sp/waic-wg4-tools check-transitions
```

`waic-main` との diff を対象に、同じ原文に対して複数の異なる訳文がある箇所を報告します。表記揺れがなくなるまで修正してください。比較対象を変えたい場合は `pnpm dlx github:ef81sp/waic-wg4-tools check-transitions <base-branch>` のように引数で指定します。

## 参考情報

- 翻訳対象の範囲: HTML 全体
- 翻訳の目的: 翻訳版としてウェブサイトで公開
- ターゲット読者: Web 開発者。ただし本文書は W3C が執筆した権威のあるもので、専門的な内容を扱う
