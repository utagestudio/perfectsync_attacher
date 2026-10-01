# ライセンス方針

## 本体コード

2026-10-01、ユーザーの指定によりMITライセンスを採用。独自のコードと文書に適用し、本文はルートの[LICENSE](../LICENSE)に置く。著作権表示はユーザー指定のブランド名に合わせて`Copyright (c) 2026 UTAGE.GAMES`とする。

商用利用・改変・再配布を許可する。コピーまたは実質的な部分には著作権表示とライセンス本文を保持する。改変者にソース公開を義務付けない。

## 第三者ライブラリ・素材

本体のMITライセンスで第三者のライセンスを置き換えない。各ライブラリのLICENSE・NOTICEと素材の利用条件を保持する。

- 直接依存のpackage.json表記：Three.js、three-vrm、Vite、PrettierはMIT。glTF Validator、PlaywrightはApache-2.0。
- 変形テンプレートはhinzka氏の[52blendshapes-for-VRoid-face](https://github.com/hinzka/52blendshapes-for-VRoid-face)を加工したもの。本体のMITの対象外とし、取得時の[利用条件](../public/templates/SOURCE-README.md)と[出所・ハッシュ](../public/templates/provenance.json)を保存する。
- 保存済みの素材利用条件には商用利用・改変・再配布・販売の許可がある。含まれる第三者の権利やサービス等の規約は別途従う。

公開前の確認として、間接依存を含むライセンス本文・NOTICE、ブラウザー配布物への必要な表示・同梱、素材の第三者条件の確認が残っている。本体のライセンス採用をもって、全依存・素材の監査完了とは扱わない。

## 入力・出力VRM

入力されたVRMに本体コードのMITライセンスを適用しない。変換後も元モデルの権利・利用条件に従い、追加した変形データの利用条件も尊重する。変換によって元モデルの商用利用・再配布等の許可範囲を拡張しない。
