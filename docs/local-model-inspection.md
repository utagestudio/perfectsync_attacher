# ローカルモデルの初回調査

調査日：2026-10-01。バージョン：`0.1.0-dev.2`。

## 再実行

`npm run inspect:vrm`で`_local/vrm/`を読み取り専用で解析する。別のディレクトリは`npm run inspect:vrm -- <directory>`で指定する。外部送信も入力の変更も行わない。

このツールはGLBヘッダー・chunk境界、VRM識別、表情参照先meshの概要を調べる開発用ツール。BIN内部のaccessor整合、頂点対応、視覚品質、完全な仕様適合はまだ検証しない。

## 結果

10件すべて概要解析成功。VRM0が2件、VRM1が8件。約13.6〜28.0 MiB。

| ファイル | 形式 | 表情定義数 | 表情対象meshの頂点数／primitive |
| --- | --- | --- | --- |
| 02_utage3.4.0-vrm0.0.vrm | 0.0 | 14 | 3,983／7 |
| 02_utage3.4vrm1.0.vrm | 1.0 | 14 | 3,983／7 |
| 6493143135142452442.vrm | 0.0 | 14 | 4,171／4 |
| JOUSHI1.vrm | 1.0 | 14 | 4,003／7 |
| bukao.vrm | 1.0 | 14 | 3,998／7 |
| client1.vrm | 1.0 | 14 | 4,380／8 |
| obasan1.vrm | 1.0 | 14 | 4,366／8 |
| ossan1.vrm | 1.0 | 18 | primitiveごとに50〜3,893／14 |
| sachiusuko.vrm | 1.0 | 14 | 3,947／6 |
| woman1.vrm | 1.0 | 14 | 4,028／7 |

全モデルの表情対象meshは57個のFcl系target名を持つ。これはPerfect Syncの52表情セットとは別物。VRoid Studioのgeneratorは1.26.0、2.5.0、2.14.0を確認。VRM0はUniGLTFのgeneratorなので、元VRoidの版はこれだけでは確定できない。

ossan1.vrmのgeneratorはBlender VRM Add-on。表情対象mesh名はBodyで、primitiveごとに頂点配列が分かれるため、Faceという名前や共有頂点配列を前提にできない。

utageの2形式は頂点数が同じだが、末尾primitiveのindices数が276と258で異なる。同じ形状・同じ頂点順だと断定せず、UV・接続・座標変換を検証する。最初のPoC候補とし、残りを対応判定の検証に利用する。

## 利用先の検証

WebcamMotionCaptureを主な検証先とする。公式の[履歴](https://webcammotioncapture.info/history.php)にはVRM1モデルの修正があり、[マニュアル](https://webcammotioncapture.info/manual.php)にはPerfect Sync対応モデルの利用手順がある。実際の使用版と表情認識は実機で別途確認する。

VSeeFaceは[公式](https://www.vseeface.icu/)でVRM0のみ対応と明記されているため、VRM0の補助検証に用いる。無料であることだけでは本ツールの出力互換性や品質を保証しない。

次の工程は供体テンプレートと入力のUV・頂点対応を調べること。変形転写・出力生成・利用先での動作確認はまだ完了していない。
