# Perfect Sync Attacher

日本語 | [English](README.en.md)

VRoid Studio製の対応VRMに、Perfect Sync用の52表情を追加するウェブアプリです。Unityの起動は不要。VRMをドラッグ＆ドロップし、表情を確認して保存できます。

現在は開発版です。公開デモのURLは未確定です。

## 使い方

1. VRMファイルをドロップするか、「ファイルを選択」から開きます。
2. 変換後の3Dプレビューで表情を確認します。スライダーで調整し、ドラッグで回転、ホイールで拡大できます。
3. 「VRMを保存」から、元の名前に`_perfectsync`を付けたファイルを保存します。

元ファイルは変更しません。プレビューのスライダー値は保存するVRMへ焼き込みません。日本語・英語・韓国語・繁体字中国語・簡体字中国語に対応し、ヘッダーから切り替えられます。

## 対応範囲・制約

- VRM 0.x／1.0を扱い、入力と同じ形式で出力します。形式間の変換は行いません。
- テンプレートと対応するVRoidの顔メッシュが対象です。VRoid製であっても、すべてのモデルに対応するわけではありません。
- 顔と身体が結合されたモデル、UV・頂点対応や三角形構造が一致しないモデル、外部バッファ・画像参照等には対応しません。
- 既存のPerfect Sync表情との衝突がある場合は停止します。本ツールで変換済みのファイルは追加せず、そのまま返します。
- 入力は1ファイルずつ、100 MiBまで。顔メッシュや内部データにも処理上限があります。
- 顔形状に合わせた簡易補正を用いるため、唇・歯・まぶた・舌の干渉や複合表情の見え方を確認してください。

ローカル検証では10モデル中8モデルを変換でき、対応出力のglTF検証エラーは0件でした。WebcamMotionCapture／VSeeFaceでの実機確認は未実施です。VSeeFace向けにはVRM 0.xを使用してください。詳細は[確認ガイド](docs/prototype-guide.md)を参照してください。

## ファイルの扱い

変換とプレビューは端末内で処理し、入力モデルをサーバーへ送信しません。アプリと表情テンプレートは配信元から取得します。現時点でアクセス解析は実装していません。手動選択した表示言語だけをブラウザーに保存します。

## 開発

Node.js 22.12以上を使用します。

```sh
npm ci
npm run dev
```

表示されたローカルURLを開いてください。

```sh
npm test                # エンジン・翻訳・言語選択の単体検証
npm run test:e2e        # Chromeの操作検証
npm run build          # Cloudflare Pages向けdist/を生成
npm run preview        # ビルド済みアプリの確認
```

ブラウザーテストはローカルChromeと検証モデルを使用します。モデルはリポジトリに含まれません。必要なモデル・配置・検証条件は[確認ガイド](docs/prototype-guide.md)と[ローカルモデル調査](docs/local-model-inspection.md)を参照してください。Chromeのパスは`PLAYWRIGHT_CHROME_PATH`で変更できます。

Cloudflare Pagesはビルドコマンド`npm run build`、出力先`dist`で配置できます。変換APIやモデル保存用ストレージは不要です。プロジェクトの設計・開発ルールは[docs/README.md](docs/README.md)にあります。

## 不具合報告

[GitHub Issues](https://github.com/utagestudio/perfectsync_attacher/issues)へ、アプリ・ブラウザーのバージョン、VRMの形式、操作手順、表示されたエラーを記載してください。VRM本体、秘密情報、公開許可のない画像は添付しないでください。

## ライセンス・謝辞

本体コードは[MIT](LICENSE)です。表情テンプレートは[hinzka氏の52blendshapes-for-VRoid-face](https://github.com/hinzka/52blendshapes-for-VRoid-face)を基にしています。第三者ライブラリとテンプレートには、それぞれの利用条件が適用されます。[ライセンス方針](docs/licenses.md)を参照してください。
