# お問い合わせフォームの実装設計

## 確定要件

- フォームの対象プロダクト名は、ユーザー確認済みの `PerfectSync Attacher` とする。既存画面の製品名表記とは別に、フォーム用の値として管理する。
- 日本語は `https://tally.so/r/kdVdDR`、英語は `https://tally.so/r/KYqY78` を使用する。
- 必ず `product` を付け、バージョンを自動取得できるアプリでは `version` も付ける。READMEには `version` を付けない。
- フォームを先に案内し、既存のGitHub Issuesを併記する。不具合報告、要望、質問の窓口とする。
- フォーム自体は変更しない。APIキーや埋め込みは不要で、外部リンクとして開く。

## 調査結果と変更対象

| 対象 | 現状 | 変更内容 |
| --- | --- | --- |
| `README.md` | 「不具合報告」でIssuesを案内 | 「お問い合わせ」に変更し、日本語フォームを先に併記 |
| `README.en.md` | 「Reporting issues」でIssuesを案内 | 「Contact」に変更し、英語フォームを先に併記 |
| `index.html` | 共通フッターにGitHubとIssues | Issues直前に翻訳対応の「お問い合わせ」リンクを追加 |
| `src/app/main.js` | `package.json`からバージョン取得、言語切替時に表示更新 | 同じバージョンを使い、初期表示・言語切替・戻る／進むでリンク更新 |
| `src/i18n/locales/*.js` | 5言語の辞書 | リンク表示名と案内用titleを全言語に追加 |
| `tools/seo.mjs` | ルートと5言語の初期HTMLを生成 | JavaScript実行前から言語とバージョンが正しいリンクを生成 |
| `docs/prototype-guide.md` | フッターのIssuesを説明 | フォーム優先の窓口案内へ更新 |
| `docs/internationalization.md`、`docs/seo-and-publication.md` | 言語切替とHTML生成の仕様 | フォームの言語選択と静的生成を追記 |

リポジトリ内には独立した紹介ページ、アプリ内ヘルプ、ストア説明文の元ファイルは見つかっていない。公開Webサイトは同じアプリのビルド成果物を使う。第三者素材の文書にある窓口は変更対象に含めない。

## 実装方針（ユーザー了承済み）

### URL生成の共通化

`config/contact.js`を追加し、製品表示名、日英フォームURL、`contactFormUrl(language, version)`を管理する。ブラウザーとHTML生成から同じ関数を利用し、Node専用APIやDOMに依存させない。

- 日本語は日本語フォーム、それ以外は英語フォームとする。韓国語・繁体字・簡体字向けフォームがないため、ユーザー了承済みの方針。対応する3言語のtitleで英語フォームであることを示す。
- `encodeURIComponent`で各値をエンコードし、空白を `%20` とする。URLSearchParamsの空白表現 `+` は使用しない。
- `version`が与えられたときだけ追加する。入力モデルのVRMバージョンではなく、アプリのバージョンを送る。
- DOMの `href` にはURL文字列を設定し、生成HTMLの属性には既存の `escapeHtml` を通して `&amp;` を出力する。

READMEで使う固定URLは次のとおり。

- 日本語：`https://tally.so/r/kdVdDR?product=PerfectSync%20Attacher`
- 英語：`https://tally.so/r/KYqY78?product=PerfectSync%20Attacher`

設計時の `package.json` は `1.0.0`。アプリ用リンクの例は `https://tally.so/r/kdVdDR?product=PerfectSync%20Attacher&version=1.0.0`。実装時にはその時点のpackage.jsonから取得する。

### フッターと初期HTML

`index.html`に `id="contact-link"` と翻訳用属性を持つアンカーを追加する。既存の外部リンクと同様に `target="_blank"`、`rel="noopener noreferrer"` を指定する。ソースHTMLのフォールバックは日本語のproduct付きURLとし、バージョン番号を手書きしない。

`renderLanguage()`内で `contactFormUrl(language, version)`を設定する。言語切替はこの既存経路に集約し、リンク更新のためにページを再読み込みしない。

`tools/seo.mjs`ではpackage.jsonのバージョンを読み、`localizedHtml()`で対象アンカーのhrefを共通関数の結果へ置換する。既存の辞書による表示名・titleの翻訳も使う。これにより開発サーバー、ルート、各言語の本番HTMLで、JavaScriptなしでも正しい窓口へ移動できる。

フッターは既存の配置を利用する。リンク追加で狭い画面に収まらない場合のみCSSを調整する。

### 案内文

READMEでは「不具合の報告、要望、質問はお問い合わせフォームへ。GitHub Issuesも利用できます」と案内する。不具合報告時に必要なアプリ・ブラウザーのバージョン、VRM形式、再現手順、エラーの案内は保持する。モデル本体や秘密情報等を添付しない既存の注意事項は、両窓口に適用する。

フッターの表示は日本語「お問い合わせ」、英語「Contact」とし、他の3言語も翻訳する。titleには報告時の既存の注意と、必要な場合に英語フォームである旨を含める。

## 実装時の検証

1. URLをパースして、日英フォームの選択、productの復元値、versionの有無・値を確認する。日本語・空白を含む値のエンコードも確認する。
2. 既存SEOテストを拡張し、ルートと5言語の初期HTMLについてフォーム、product、package.json由来のversion、属性内の `&amp;`、フォーム→Issuesの順序を確認する。
3. ブラウザーで初期表示、保存済み言語、言語切替、戻る／進むのhrefを確認する。5言語と既存の代表画面サイズで、リンク追加後も待機・結果画面が収まるか確認する。
4. `npm test` と `npm run build`、関連するブラウザーテストを実行する。ビルド後のHTMLを配信し、JavaScript無効時もリンクが利用できることを確認する。
5. 日英の最終URLを実際に開き、フォーム上でproductとversionの初期値を確認する。READMEのリンクではversionを渡していないことを確認する。フォームは送信しない。

## 作業単位と公開

小さな機能追加として `1.1.0-dev.1` から実装を開始した。共通URL生成・フッター・翻訳・HTML生成・必要な検証を整合した単位でコミットし、READMEと運用文書もレビュー可能な単位でコミットする。実際にversionへ入る値は各ビルドのpackage.jsonに追従する。

外部のストア・配布ページの存在や本文は未確認。該当ページがある場合はユーザーによる差し替え対象として、日英READMEと同じproductのみのURLを案内する。アプリへの反映には通常のリリース・デプロイが必要。今回の作業では外部ページの編集、push、公開は行わない。

## 実装・検証結果（2026-10-05）

- 日英READMEと共通フッターにフォームを追加し、Issuesを保持した。5言語の表示名・title、初期HTML、実行時の言語切替に対応した。CSS調整は不要だった。
- `npm test`は7テストファイル成功、`npm run build`成功。既存の大きなプレビューチャンクに対する警告は残る。
- フォーム関連・SEOのブラウザーテスト4件が成功。5言語×5画面サイズで待機・結果画面のリンク表示とページのスクロール範囲を確認した。
- ビルド済みルート・5言語の計6ページをJavaScript無効で開き、product・version・フォームの選択を確認した。
- 日英の実フォームを、productのみ／productとversionの計4通りで開いた。製品名が`PerfectSync Attacher`、version付きでは`1.1.0-dev.1`、versionなしでは空欄となることを確認した。送信は行っていない。
- 外部ストア・配布ページの変更は行っていない。該当する案内がある場合は、日英READMEに記載したproductのみのリンクへユーザーが差し替える。公開アプリへの反映はリリース・デプロイ後となる。

## リリース

ユーザーの動作確認後、`1.1.0`として確定した。フォームのversionはリリースビルドで`1.1.0`となる。
