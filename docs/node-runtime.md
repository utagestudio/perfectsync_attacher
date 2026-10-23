# Node.jsの運用

## 採用バージョン

Node.js **26.12.1**を採用する。2026年10月21日のセキュリティ修正を含む26系であり、`.node-version`をローカル・Cloudflare Pages共通のバージョン指定とする。`package.json`の`engines.node`は`>=26.12.1 <27`とし、次のメジャーへの意図しない移行を避ける。

2026年10月23日時点の26系はCurrent。採用理由は修正済みの26系へ開発環境を統一し、今後の移行負担を減らすため。公開アプリは静的配信とブラウザー実行のため、Node.js更新による利用者側の変換速度改善を目的とはしない。

## ローカル

`.node-version`対応のバージョン管理ツールで指定バージョンを導入する。miseを使用する場合は次のように実行する。

```sh
mise install node@26.12.1
mise exec node@26.12.1 -- node --version
mise exec node@26.12.1 -- npm ci
mise exec node@26.12.1 -- npm test
mise exec node@26.12.1 -- npm run build
```

Git管理外の`mise.toml`に`[tools]`の`node = "26.12.1"`を設定すると、このプロジェクトの通常操作にも適用できる。グローバルのNode.js指定は変更しない。

## Cloudflare Pages

- 本番ブランチは`master`、ビルドは`npm run build`、出力先は`dist`。
- 本番・プレビュー双方で`.node-version`による指定を使用する。既存の`NODE_VERSION`がある場合は削除するか、`26.12.1`へ揃える。
- Pages v3は`package.json`の`engines`からNode.jsを選択しない。必ずビルドログで実際のNode.jsバージョンを確認する。
- 開発ブランチのプレビュービルドで動作確認後に本番へ反映する。本番設定の変更・マージ・再デプロイは公開操作として扱う。
- 変更前の本番デプロイIDと設定を記録し、障害時は正常なデプロイへ戻す。古いNode.jsへの復帰を恒久対応にしない。

## 更新時の検証

セキュリティ修正の有無を公式情報で確認し、`.node-version`、`engines`の下限、ローカル設定、Cloudflare環境変数、文書を揃える。`npm ci`、`npm audit`、`npm test`、`npm run test:e2e`、`npm run test:analytics`、通常・URLなし・プレビューブランチのビルドを確認する。依存関係の一括更新は行わず、必要な修正を分けて記録する。

## 公式資料

- [Node.js 26.12.1](https://nodejs.org/en/blog/release/v26.12.1)
- [2026年10月のセキュリティ修正](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Cloudflare Pagesのビルド環境](https://developers.cloudflare.com/pages/configuration/build-image/)
