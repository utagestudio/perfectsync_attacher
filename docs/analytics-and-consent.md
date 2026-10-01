# アクセス解析と同意管理

## 方針と環境変数

解析目的はアクセス数の把握のみ。変換・保存・プレビュー・スライダー・言語切替の操作イベントを追加しない。モデル、ファイル名、画像、頂点、VRMメタ情報を計測イベントに含めない。

ビルド環境変数は **`GTM_ID`**。`GTM-`から始まるGoogle Tag ManagerのコンテナーIDを設定する。従来案の`GTAG_ID`やGA4の`G-`IDはアプリの設定キーとして使用しない。GA4の測定IDはGTM内で設定する。

```sh
# ローカルで同意画面を確認する場合（実際のコンテナーIDを使用）
GTM_ID=GTM-YOURID npm run dev
# 配信用のビルド
GTM_ID=GTM-YOURID npm run build
```

未設定・空欄ではGoogleタグを読み込まず、同意画面やフッターの設定ボタンも表示しない。不正なIDではビルド・開発サーバー起動を停止する。Viteの環境変数を一括公開せず、このIDだけを明示的に取り込む。IDはブラウザーから参照できる公開設定であり、秘密鍵ではない。

## 利用者の操作と保存

初回は5言語の同意パネルを表示する。許可・拒否を選べ、閉じて選択を保留することもできる。パネルは非モーダルで、同意しなくても変換・保存・プレビューを利用できる。フッターの「アクセス解析」から設定を再表示する。

許可・拒否は`localStorage`の`perfectsync-attacher.analytics-consent`へ、選択日時・有効期限・コンテナーID・形式バージョンとともに保存する。**保存期間は90日（ユーザー了承済み）**。期限切れ、不正な保存データ、コンテナーID変更時は未選択へ戻す。保存できない環境では、現在のページを開いている間だけ選択を保持する。言語設定とは別の記録で、モデルや操作履歴は保存しない。

公開ドメイン`perfectsync.utage.games`と`perfectsync-attacher.pages.dev`はoriginが異なるため、選択はそれぞれ独立する。同じoriginの別タブで拒否・撤回すると、起動中の計測も停止する。ページを開いたまま90日を超える場合も、期限を確認して停止する。

## 同意後だけ動く計測ページ

許可されるまで計測ページもGTMも読み込まない。basic consent modeの方針に合わせ、未同意・拒否時はGoogleへの計測通信を発生させない。noscript用のGTM iframeや、Googleへの事前接続も追加しない。

許可後に同一originの非表示iframeで`analytics.html`を開く。GTMとそのdataLayerはこのページ内で実行し、アプリ本体のdocumentへGoogleスクリプトを追加しない。計測ページ単独でのアクセスではGTMを起動しない。

初期化では`analytics_storage`だけを許可し、広告保存・広告利用者データ・広告パーソナライズは拒否する。Google Signalsと広告パーソナライズも無効にする。計測用URLは実際のoriginと既知の言語パスだけに限定し、query・hash・任意のパス・参照元を渡さない。タイトルは固定の製品名とする。

アプリが発行するカスタムイベントは`psa_page_view`のみ。`page_location`、固定の`page_title`、空の`page_referrer`を渡す。1回のページ読み込みにつき最大1回発行し、言語切替・設定の再表示・同じページでの再許可では追加しない。アクセス数は同意・読み込みに成功した範囲の値となる。

撤回・期限切れでは、計測ページに新規通信を拒否するCSPを適用してからiframeを破棄し、現在のホストの標準GA Cookie（`_ga`・`_ga_*`・`_gid`・`_gat*`）を削除する。親ドメイン等の他サイトのCookieは削除しない。出力ファイルとプレビューは維持する。撤回前に送信済みの情報や開始済みの通信は取り消せない。

iframeは実行停止のための構成であり、任意のGTMコンテナーからのアクセスを制限するセキュリティ境界ではない。以下のGTM設定を使用し、Custom HTMLや親ページのDOMを参照するタグ・変数を追加しない。

## GTM・GA4側の設定（運営者が行う作業）

GTMコンテナーIDだけではアクセス数を計測できない。GA4のプロパティ・ウェブデータストリームと測定ID（`G-...`）を用意し、GTM内のタグを設定して公開する。

1. GA4のウェブデータストリームで **拡張計測をすべてOFF** にする。スクロール・外部クリック・サイト内検索・動画・ダウンロード・フォームと、履歴変更による自動ページビューを収集しない。
2. GTMに **Googleタグ** を作成し、GA4の測定IDを指定する。Initialization（初期化）トリガーで起動し、`send_page_view`を`false`、`cookie_domain`を組み込み変数`{{Page Hostname}}`、`cookie_path`を`/`、`cookie_update`を`false`、`allow_google_signals`と`allow_ad_personalization_signals`を`false`にする。アプリが渡す`page_location`・空の`page_referrer`・Cookie有効期間を別の値で上書きしない。
3. データレイヤー変数`page_location`、`page_title`、`page_referrer`（バージョン2）を作成する。
4. カスタムイベントトリガー **`psa_page_view`** を作成する。
5. **GA4イベントタグ** を作成し、イベント名を **`page_view`**、トリガーを上記`psa_page_view`にする。イベントパラメーターとして上記3変数を設定する。`psa_page_view`自体を別のGA4イベントとして送信しない。
6. タグの追加同意チェックに`analytics_storage`を指定する。広告タグ、Conversion Linker、Google Signals、広告連携・パーソナライズ、クリック／フォーム／履歴等のトリガー、Custom HTML、Custom JavaScript変数は追加しない。
7. コンテナーを公開し、許可後のページビューが1回、機能操作によるイベントが0回、未同意・拒否・撤回後の新規通信が0回であることを確認する。

GA4は基本計測に伴う識別Cookie・ネットワーク／端末情報や、`session_start`・`first_visit`等の自動イベントも扱う。「アクセス数のみ」は本ツールの機能操作やモデル情報を計測しない方針であり、Google側の全データを数値1項目だけに制限する意味ではない。標準GA Cookie以外を使う設定やCustom HTML等を加える場合は、この停止・削除仕様の対象外となる。

## Cloudflare Pagesの設定

両ドメインはユーザーにより公開済み。本作業の変更を反映する際は、Pagesの本番ビルド環境変数に`GTM_ID`を設定し、変更を含むコードを再ビルド・配信する。環境変数変更だけでは既存の配信物は変わらない。プレビュー環境で計測しない場合は、その環境のIDを未設定にする。

`dist/_headers`はIDの有無に合わせて生成する。IDがある場合だけGoogle Tag Managerのスクリプト、Google Analyticsの通信・画像、`www.google.com`への接続を許可する。広告用ホスト・unsafe-eval・スクリプトのunsafe-inlineは追加しない。同一originの計測ページを埋め込めるようframe-srcとframe-ancestorsをselfにする。IDなしでは従来の外部スクリプト禁止・frame-ancestors noneを維持する。埋め込みテクスチャ取得用のblob接続は両構成で許可する。

GTMプレビュー用の外部リソースはCSPへ追加しないため、Tag Assistantの一部機能がブロックされる場合がある。実際のGA4タグや本番通信は、設定済みコンテナーを公開して別途確認する。

## 検証

`npm test`は保存・期限・ID変更・破損データ・保存不可・URL制限・Cookie削除範囲・ID形式・CSPの条件を確認する。

`npm run test:e2e`はIDなしの通常構成を、`npm run test:analytics`はテスト用IDありの構成を検証する。同意検証ではGoogleの応答をローカルの模擬タグへ置き換え、実際のGoogleへテスト通信を送信しない。未同意・拒否、許可・撤回、期限切れ、保存不可、別タブ同期、再許可の重複防止、5言語の小画面配置と変換・プレビューを確認する。

本物のGTM・GA4設定内容や集計結果は本作業では確認していない。テストに通った模擬タグと、実際に運営するコンテナーの内容を区別する。

## 公式資料

- [Google：basic consent mode](https://support.google.com/tagmanager/answer/10000067)
- [Google：同意モードの実装](https://developers.google.com/tag-platform/security/guides/consent)
- [Google：GTMとCSP](https://developers.google.com/tag-platform/security/guides/csp)
- [Google：GA4ページビュー](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google：拡張計測](https://support.google.com/analytics/answer/9216061)
