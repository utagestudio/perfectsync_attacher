# ライセンス方針

## 本体コード

2026-10-01、ユーザーの指定によりMITライセンスを採用。独自のコードと文書に適用し、本文はルートの[LICENSE](../LICENSE)に置く。著作権表示はユーザー指定のブランド名に合わせて`Copyright (c) 2026 UTAGE.GAMES`とする。

商用利用・改変・再配布を許可する。コピーまたは実質的な部分には著作権表示とライセンス本文を保持する。改変者にソース公開を義務付けない。

## 第三者ライブラリ・素材

本体のMITライセンスで第三者のライセンスを置き換えない。各ライブラリのLICENSE・NOTICEと素材の利用条件を保持する。

- 直接依存のpackage.json表記：Three.js、three-vrm、Vite、PrettierはMIT。glTF Validator、PlaywrightはApache-2.0。
- 変形テンプレートはhinzka氏の[52blendshapes-for-VRoid-face](https://github.com/hinzka/52blendshapes-for-VRoid-face)を加工したもの。本体のMITの対象外とし、取得時の[利用条件](../public/templates/SOURCE-README.md)と[出所・ハッシュ](../public/templates/provenance.json)を保存する。
- 保存済みの素材利用条件には商用利用・改変・再配布・販売の許可がある。含まれる第三者の権利やサービス等の規約は別途従う。

公開前チェックで、lockfileの60依存エントリーのライセンス表記と、この環境にインストールされたパッケージのLICENSE・NOTICE等の所在を確認した。ライセンス種別はMIT・Apache-2.0・ISC・BSD-3-Clause・MPL-2.0。未インストールの他OS向けoptional依存は表記のみの確認であり、全プラットフォームの本文監査完了とは扱わない。開発用native bindingの一部はルートにLICENSEがないため、親パッケージrolldownのMIT本文・第三者ライセンスを併せて参照する。

ブラウザー配布物のライセンス本文はViteの`build.license`で`dist/THIRD-PARTY-LICENSES.txt`へ出力し、画面からリンクする。現在のバンドルにはThree.jsとthree-vrmが含まれ、pixiv系列14パッケージのMIT本文は一致している。本体のMIT本文も`dist/LICENSE.txt`へ同梱する。Viteが生成するブラウザー用補助コードの表示も保持するため、ViteのLICENSE（同梱依存の表示を含む）を`dist/VITE-LICENSE.txt`へ同梱する。開発・検証用のVite、Lightning CSS、Playwright、glTF Validator等の実行コードはdistへ同梱しない。これらやnode_modulesを別途再配布する場合は、元のLICENSE・NOTICEと各条件を維持する。


## 入力・出力VRM

入力されたVRMに本体コードのMITライセンスを適用しない。変換後も元モデルの権利・利用条件に従い、追加した変形データの利用条件も尊重する。変換によって元モデルの商用利用・再配布等の許可範囲を拡張しない。
