# README・SEOと公開設定

## 公開URLと生成物

公開予定URLは`https://perfectsync.utage.games/`。日英READMEと、モデルを含まない待機画面の例を用意する。

本番ビルドでは次の静的ページを生成する。画面は共通で、言語ごとの初期HTML・title・descriptionを翻訳する。

| URL | 表示 |
| --- | --- |
| `/` | 初期HTMLは日本語。起動後は保存済み選択またはブラウザー設定を使用 |
| `/ja/` | 日本語 |
| `/en/` | 英語 |
| `/ko/` | 韓国語 |
| `/zh-Hant/` | 繁体字中国語 |
| `/zh-Hans/` | 簡体字中国語 |

言語別URLは保存済み選択やブラウザー設定より優先する。言語切替は履歴に言語別URLを追加し、モデル・Worker・スライダー値を維持する。「戻る」「進む」でも表示を切り替える。

各ページに自己参照のcanonical、5言語相互のhreflang、ルートを指すx-defaultを設定する。OGPはtitle・description・URL・localeと1200×630の共有画像、X向けはsummary_large_imageを設定する。画像は独自の文字・図形だけで、モデルや第三者の画像を含まない。

`robots.txt`と6URLの`sitemap.xml`を生成する。トップレベルの`404.html`を配置し、Cloudflare Pagesで不明なURLをアプリへフォールバックさせない。言語別ページは各ディレクトリーの`index.html`として出力し、Cloudflare Pagesの通常の静的配信を利用する。

## ビルド・配信設定

Cloudflare Pagesのビルドコマンドは`npm run build`、出力先は`dist`、本番ブランチは`master`を想定する。カスタムドメインとして`perfectsync.utage.games`を設定する。ドメインの接続・DNS・デプロイはこの工程では実施していない。

公開URLの既定値は`config/site.js`で管理する。別ドメインで公開する場合は、ファイルを変更するかビルド環境の`SITE_URL`で上書きする。HTTPSのoriginのみを受け付け、パス・認証情報・query・fragmentを含む値ではビルドを停止する。環境変数全体をブラウザーへ公開する仕組みは追加しない。

```sh
npm run build
# 別ドメインへのビルド
SITE_URL=https://your-domain.example npm run build
# 公開URLを使用しない検証ビルド
SITE_URL='' npm run build
```

公開URLが空のビルドはnoindexと`Disallow: /`を設定し、canonical・hreflang・サイトマップを生成しない。開発サーバーのHTMLにもnoindexを設定する。

Cloudflareが`CF_PAGES_BRANCH`を設定し、その値が`master`以外なら、URLの設定があってもnoindexと`Disallow: /`を設定し、サイトマップを生成しない。本番ブランチを変更する場合は`vite.config.js`の判定も変更する。ローカルの通常ビルドは本番向けとなるため、検索対象外の外部検証環境へ配置する場合は上記の検証ビルドを使用する。

本番の公開後、実URLのレスポンス・言語別HTML・canonical・hreflang・共有画像・robots.txt・sitemap.xml・不明URLの404を確認する。CloudflareのHTTPS・CSP等の配信ヘッダーは本番レスポンスで確認する。Search Consoleを利用する場合はドメインを確認し、サイトマップを登録する。検索順位・インデックス登録やSNSの画像反映は保証しない。

## 保守と検証

`tools/seo.mjs`が初期HTMLの翻訳とメタ情報生成を担当する。`data-i18n`対象は子要素を含まない文言用要素にし、子要素がある場合は専用spanへ分ける。本文の翻訳はアプリと同じ辞書を使う。

`assets/og.svg`を編集し、`node tools/generate-og.mjs`で`public/og.png`を更新できる。ローカルChromeが必要で、`PLAYWRIGHT_CHROME_PATH`で実行ファイルを指定できる。

単体検証はURL制限、5言語の初期HTML・canonical・hreflang、サイトマップ、検索対象外ビルドと404生成を確認する。Chrome操作検証はJavaScript実行前の翻訳HTML、URLの優先順位、言語切替・戻る操作と調整値の保持を含む。通常・URLなし・Cloudflare開発ブランチの本番ビルドも確認する。実際のCloudflare配信確認は公開後に実施する。

## 参照した公式資料

- [Google：多言語・多地域サイトの管理](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google：言語別ページとhreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Cloudflare Pages：静的ページ・URL・404配信](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Vite：HTML変換とプラグインAPI](https://vite.dev/guide/api-plugin.html)
