# Perfect Sync Attacher：実現可能性と設計

調査日：2026-10-01。以下は初期設計。最新の実装・検証状況と設計との差分は[プロトタイプ確認ガイド](prototype-guide.md)を参照。

## 1. 結論

VRoid Studio製VRMにPerfect Sync用の変形データと表情定義を追加し、ブラウザーからVRMをダウンロードするツールは実現可能。Unityの起動は不要。

推奨は「Cloudflareで静的Webアプリと変形テンプレートを配信し、ユーザーのブラウザー内で変換する」構成。最初の公開範囲は、実測した顔メッシュの構造に一致するVRoidモデルに限定する。VRM 0.x／1.0の両形式を扱うが、全VRoid世代・改変モデルへの自動適用は初期要件にしない。

難しい部分はファイル書き込みではなく、モデルごとの顔に適合する52種類の変形データの用意と転写品質である。名前だけの追加や既存の母音表情の組み合わせでは、独立した頬・鼻・唇・舌の動きまで復元できない。

## 2. 出力に必要なもの

Shape KeyはBlenderでの呼び方。VRMではglTFのMorph Targetとして頂点の移動量を保存する。実装は次の3層を追加する。

1. 各対象primitiveの`targets`にPOSITION変位、必要に応じてNORMAL／TANGENT変位。
2. 実装慣例の`mesh.extras.targetNames`に表情名。
3. VRMの表情定義から対応するMorph Targetへのバインド。

52種類はARKit系の表情セットを基準にする。表情名の大文字・小文字、認識対象がMorph Target名かVRM表情名かは利用先アプリで検証し、対応プロファイルとして固定する。VSeeFace公式は52個すべてのBlendShape Clipを要求している。空のClipが許容されても、本ツールで空の変形を「生成完了」と扱わない。

| 項目 | VRM 0.x | VRM 1.0 |
| --- | --- | --- |
| 判定 | `extensions.VRM`とその内容 | `extensions.VRMC_vrm.specVersion` |
| 追加先 | `VRM.blendShapeMaster.blendShapeGroups` | `VRMC_vrm.expressions.custom` |
| 参照 | `binds[].mesh`、`index` | `morphTargetBinds[].node`、`index` |
| 全量適用のweight | 100 | 1 |
| 設定 | `presetName: "unknown"`、`isBinary: false` | `isBinary: false`、override各種は原則`"none"` |

VRM 1.0はmeshを持つnodeを参照する。同じmeshを複数nodeが利用する場合も考慮する。複数の顔パーツを動かす表情は複数bindを持つ。

出力形式は入力形式を維持する。0.x→1.0、1.0→0.xの形式変換は別機能であり、MVPに含めない。VSeeFaceは調査時点でVRM0のみ対応しているため、VRM 1.0の変換成功はVSeeFaceでの利用を保証しない。

## 3. 変形生成方式

| 方式 | 利点 | 制約 | 採用判断 |
| --- | --- | --- | --- |
| 対応テンプレートから変位を転写 | 高速で再現性が高い | 頂点対応と顔の形状差の扱いが必要 | MVPの主方式 |
| 既存表情の分割・合成 | 入力だけで一部を生成できる | 元にない変形は復元できない | 将来の補助方式 |
| ランドマーク・領域ベースの手続き変形 | 対応範囲を広げられる | 唇、歯、まぶた等の品質調整が難しい | 将来の研究対象 |
| 異なるトポロジーへの表面転写 | 改変モデルを扱える可能性 | 対応推定、口内、左右、UV継ぎ目の処理が難しい | MVP対象外 |

### 3.1 テンプレート

配布可能な供体モデルからビルド時に次を抽出し、モデル全体ではなく変換に必要なデータを配信する。

- 基準顔の頂点位置、法線、三角形、UV、パーツ境界、必要なランドマーク。
- 52表情の頂点変位と対象パーツ、必要な補助変形。
- 入力との対応を判定する構造署名と頂点マッピング。
- 座標系・単位・適用方式・対応実測モデル・データ版。
- 供体の出所、取得時の利用条件、ファイルhash。

候補はhinzka氏の52blendshapes-for-VRoid-face。調査時点のREADMEには商用利用、改変データを含む再配布・販売が可能と記載されている。採用時は取得版の条件と第三者条件を記録する。有料ツール付属データの流用を前提にしない。

男性／女性の区別やVRoidのバージョン名だけでテンプレートを選ばない。モデルの形状と構造から選び、判定が曖昧なら自動変換を停止する。対応テンプレートの整備はリリースの前提条件。

### 3.2 対応判定

顔候補を既存のblink・母音bind、headとの関係、材質、構造特徴から抽出する。`Face`等の名前だけには依存しない。

頂点数が同じでも頂点順が異なることがある。頂点数、三角形接続、UV対応、パーツ構成等を組み合わせて一致を確認する。primitive分割やUV継ぎ目の重複頂点を含むため、構造署名は対応を確定する補助手段であり、単一hashだけで万能な判定はできない。頂点順が違う既知形式は事前に検証したマッピングで扱う。

「VRoidは全世代で顔トポロジーが同じ」という仮定は置かない。VRoid世代、書き出し設定、最適化、VRM形式を分けた実モデルで対応表を作る。

### 3.3 変位の適用

基本は`出力位置 = 入力の中立位置 + 対応済みの供体変位`。供体の変形後の絶対位置をコピーすると、入力の顔が供体に近づいてしまう。

顔の大きさや比率が違う場合は、供体→入力の局所変換を推定して変位を補正する。頭部座標への整列、全体スケール補正を最初に検証し、必要なら局所フレーム等へ拡張する。非一様変換の法線は位置変位と同じ変換では扱わず、変形後メッシュからの再計算等で整合させる。法線・接線の更新はUV継ぎ目とハードエッジを維持する。

VRM形式間の向きの差やnode変換は、供体・入力それぞれから明示的に解決する。プレビュー用ローダーが行う座標変換をファイルへそのまま書き戻さない。左右はモデル自身の左右で判定する。

歯、舌、口内、まつ毛等も必要な変形対象として扱う。舌が存在しないモデルでは、既存頂点の移動だけで適切なtongueOutは作れない。MVPは必要な形状を持つモデルを対応条件にし、欠落を検出したら理由を表示する。

## 4. システム構成

```text
Cloudflare Pages
  ├─ HTML / JS / CSS
  └─ テンプレートmanifest・変位データ
          ↓ 配信
ユーザーのブラウザー
  ファイルをドロップ
       ↓
  Web Worker：GLB解析 → 対応判定 → 変位転写 → VRM表情追加
       ↓
  出力を再解析・検証
       ↓
  3D確認（任意） → ダウンロード
```

VRMをサーバーに送信するAPIは設けない。モデルの処理時間やサイズはCloudflare WorkersのCPU・メモリー制限に影響されない。ただしブラウザー自身のメモリー制限は残る。

Cloudflare Pagesの単一静的ファイル上限は25 MiB。テンプレートは必要な差分だけ抽出し、必要なら分割する。Workersのメモリー上限は128 MBで、FreeのCPU時間は10 msなので、大きなVRMの変換処理をWorkerサーバーに載せる構成は推奨しない。R2はテンプレート容量が増えた場合に検討する。

推奨技術はTypeScript、Vite、UIにReact、計算にWeb WorkerとTypedArray。プレビューはThree.js＋@pixiv/three-vrm。WASMは計測で必要になった場合に導入する。初期はWebGPUやSharedArrayBufferを必須にしない。

## 5. ファイル編集エンジン

Three.jsで読み込んだモデルの一般的な再エクスポートに頼らず、元GLBのJSONとBINを直接編集する。元の材質、テクスチャ、Spring Bone、ライセンス情報、未知extension等の欠落を避けるため。

処理手順：

1. GLB magic、version、総長、chunk長、JSON、BIN、参照範囲を検証。
2. VRM仕様を識別し、既存表情と顔パーツを解析。
3. accessorのoffset、stride、sparseを解決して必要な頂点だけ読む。
4. 対応テンプレートを選択し、不一致なら変更前に停止。
5. 欠けている表情の変位を生成し、新しいaccessor／bufferView／BIN領域を末尾追加。
6. 対象meshの全primitiveでtarget数と順序をそろえる。動かさないprimitiveには有効なゼロ変位targetを用意する。
7. targetNames、mesh.weights、存在するnode.weightsを新しいtarget数に合わせて拡張。追加weightは0。
8. バージョン別adapterでVRM表情のbindを追加。
9. 4バイト境界とJSON／BIN paddingを守り、GLB全長、chunk長、buffer.byteLengthを更新。
10. 出力を再解析し、参照整合と必須表情を検証してBlobを返す。

POSITION変位はFLOAT／VEC3で、適切なmin／maxを記録する。ゼロが多い変位はsparseで容量削減できるが、利用先の実機互換性を確認する。最初にdenseで正しさを検証し、sparseを追加する順序がよい。

元BINを維持して末尾追加し、既存indexの再番号付けを避ける。GLBの未知chunkや必須extensionは意味を把握できない場合に黙って捨てず、保持可能性を検査し、保証できなければ非対応にする。

既存のweights animationはtarget数追加で出力配列の次元が変わる。MVPでは対象meshにweights animationがある入力を理由付きで拒否し、後続版で補間方式ごとの再パックに対応する。圧縮geometryや外部URI参照もMVPでは検出して非対応とする。外部URLを入力内容に従って自動取得しない。

### 既存表情の衝突

同名の表情・targetは既存を優先し、不足分だけ追加する。既存targetはあるが表情定義がない場合は、名前だけで断定せず対応を検証してbindを追加する。重複名や空bind等は検出し、既存品質に問題がある場合は要確認として表示する。既存のemotion・blink・母音は保持し、二重適用はプレビューと利用先テストで確認する。

同じ出力を再投入しても追加数が増えない冪等性を保証する。全面的な上書き・修復は後続の明示的な操作にする。

## 6. 操作設計

- 最初の画面：ドロップ領域、ファイル選択ボタン、「ファイルは端末内で処理します」。
- ドロップ後：形式・対応可否を自動判定し、対応モデルなら自動処理。
- 処理中：現在の工程、進捗、キャンセル。キャンセルはWorker終了で実現。
- 完了：`元ファイル名_perfectsync.vrm`をダウンロードするボタンと追加／既存／要確認の件数。
- 任意の確認：52表情の単独スライダー、左右の瞬き、顎開き、笑顔、頬、視線、舌、および組み合わせのプリセット。
- 非対応：具体的な理由と対処。「顔の頂点構造が対応データと一致しません」「舌の形状がありません」等。

ダウンロードはボタン操作を基本にし、自動保存がブラウザーで制限されても利用できるようにする。プレビュー開始前に変換バッファを解放できる構成とし、大きなモデルで3D表示が失敗しても検証済みファイルの保存は可能にする。

## 7. モジュール案

```text
src/
  app/                 ドロップ・状態・保存UI
  worker/              変換ジョブ・進捗
  glb/                 パーサー・accessor reader・writer
  vrm/                 detect・vrm0 adapter・vrm1 adapter
  face/                候補抽出・構造照合・頂点マッピング
  transfer/            変位適用・座標変換・法線
  validation/          参照・表情・出力整合
  preview/             three-vrmによる確認
templates/
  manifest.json        データ版・対応署名・取得条件
tools/
  extract-template/    開発時の供体データ抽出
tests/
  fixtures/            再配布可能な検証モデル
```

エンジンAPIは`analyze(input)`と`convert(input, options)`に分ける。解析結果にはVRM形式、顔候補、対応template、既存表情、非対応理由、追加データ容量の見積もりを含める。変換結果には出力と機械可読な検証結果を返す。

## 8. 品質・性能と受け入れ基準

対応マトリクスはVRM形式×VRoid世代×顔形状×書き出し設定×利用先アプリで管理する。最初はデスクトップChrome／Edge／Firefox／Safariを評価対象とし、モバイル対応は計測後に決める。

- 52表情の名前・bind・変位が存在し、意図したパーツが0／0.5／1で動く。
- 単独・複合表情でまぶた、歯、唇、舌、まつ毛の破綻が許容範囲内。
- 表情weightが0のとき入力の顔形状、衣装、材質が維持される。
- 元のVRM表情とその他extensionの参照が壊れない。
- GLB再読込、Khronos glTF Validator、VRM schema確認が通る。schemaだけでは視覚品質は判定できない。
- 独立したVRM実装と利用先アプリで読込・表情制御が通る。three-vrm内だけの成功で判定しない。
- 非対応入力が中途半端な「成功」にならない。二回目の変換で表情が増えない。
- 通信を確認し、モデル本体・頂点・埋め込み画像が外部へ送信されない。

FLOATのPOSITION差分をdenseで保存すると、頂点数Nに対して52×N×3×4 byte。N=10,000なら約5.95 MiB、NORMALも同量追加すると約11.9 MiB。複数パーツとゼロtargetの容量も含めて見積もる。

Web WorkerはArrayBufferをtransferしてコピーを抑え、表情ごとに処理する。最終Blob・入力・出力・プレビューGPUデータが同時に残ると入力サイズ以上にメモリーを使う。ファイル上限は実測して設定し、初期の暫定値は100 MiBとする。これはCloudflareのアップロード上限に由来する制約ではない。

対応PCで50 MiB入力を10秒程度で処理することを暫定目標に置くが、現時点では未計測。性能とメモリー測定後に公開要件を確定する。

## 9. 開発順序と判断ゲート

1. **データ調査・PoC**：再配布可能な供体とVRM0／1の入力をそろえ、構造対応、単独52表情、出力読込を検証。ここで顔転写品質が成立するか判断する。
2. **変換コア**：GLB直接編集、両adapter、非対応判定、既存保護、再変換の冪等性、出力検証。
3. **Web MVP**：ドロップ、Worker、進捗、キャンセル、保存、簡易表情確認。
4. **互換性検証・公開**：対応マトリクス、性能計測、Cloudflare Pages配信、テンプレート版管理。
5. **拡張**：対応VRoid世代追加、顔形状補正、強度調整、ユーザー供体、異トポロジー転写。

概算は、経験のある開発者1人でPoCに1〜2週間、限定対応MVPに追加3〜6週間、検証・調整に追加1〜3週間。これは見積もりであり、テンプレートが適合しない場合や変形データの新規制作が必要な場合は別途期間を要する。

最初の具体的成果物は「VRM0とVRM1の各対応サンプルに、許諾条件を記録した供体から52表情を追加し、実アプリで動くことを確認したPoC」とする。この検証に通るまで全VRoid対応を約束しない。

## 10. 参照

- [glTF 2.0仕様：Morph Target・accessor・GLB](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [VRM0 BlendShape Group schema](https://raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/0.0/schema/vrm.blendshape.group.schema.json)
- [VRM0 Bind schema](https://raw.githubusercontent.com/vrm-c/vrm-specification/master/specification/0.0/schema/vrm.blendshape.bind.schema.json)
- [VRM1 Expressions仕様](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/expressions.md)
- [hinzka氏の配布データ・利用条件](https://github.com/hinzka/52blendshapes-for-VRoid-face)
- [three-vrm公式リポジトリ](https://github.com/pixiv/three-vrm)
- [VSeeFace公式：入力形式とRequired blendshapes](https://www.vseeface.icu/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

上記仕様に基づく設計判断と、未検証の性能目標・工数見積もりは区別して記載した。実モデルから確定した対応範囲は今後この文書に追記する。
