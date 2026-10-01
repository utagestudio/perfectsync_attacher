# Perfect Sync Attacher

VRoid製VRMにPerfect Sync用の52表情を追加する、ブラウザー内変換プロトタイプです。

## 起動

Node.js 22.12以上で実行してください。

```sh
npm ci
npm run dev
```

表示されたローカルURLを開き、VRMをドロップしてください。変換後は保存と52表情の3Dプレビューができます。検証用モデルは`_local/vrm/`、生成済みサンプルは`_local/output/`にあります。

現在の対応状況・制約・検証結果は[プロトタイプ確認ガイド](docs/prototype-guide.md)を参照してください。

```sh
npm test                # 変換エンジンの回帰検証
npm run test:e2e        # Chromeで変換・保存・プレビューを検証
npm run convert:local  # ローカル検証モデルを変換
npm run validate:local # 元と出力をglTF Validatorで比較
npm run build          # Cloudflare Pages向けにdist/を生成
```

プロジェクトの背景とルールは[docs/README.md](docs/README.md)にあります。
