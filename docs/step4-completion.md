# Step 4 完了確認

確認日：2026-07-25

## 判定

要件定義書の「Step 4：抽出精度と保存体験の改善」に記載された10機能はすべて実装済みであり、3つの完了条件を満たしている。よって、Step 4は完了と判定する。

## 機能要件との対応

| 区分 | 要件 | 実装・検証の主な証跡 |
|---|---|---|
| 既存実装 | URL構造によるグルーピング | `imageCandidateScorer.ts`のURLディレクトリ単位の加点、`imageCandidateScorer.spec.ts` |
| 本日実装 | DOM構造による画像グループ判定 | `image_candidate_extractor.py`の親グループ・CSSクラス抽出、`imageCandidateScorer.ts`のDOM加点、`dom-image-grouping.md` |
| 既存実装 | 画像ファイル名の連番判定 | `imageSequenceDetector.ts`、`imageSequenceDetector.spec.ts` |
| 既存実装 | 広告・アイコン除外 | `imageCandidateScorer.ts`の装飾画像名の減点、`imageCandidateScorer.spec.ts` |
| 本日実装 | 既存作品候補 | `existingSeriesSuggestions.ts`、`existingSeriesSuggestions.spec.ts` |
| 本日実装 | 話数候補 | `saveMetadataSuggestions.ts`、`saveMetadataSuggestions.spec.ts` |
| 本日実装 | ページタイトルからのタイトル候補 | `page_metadata_extractor.py`、`test_page_metadata_extractor.py`、`saveMetadataSuggestions.spec.ts` |
| 既存実装 | 重複URLの詳細表示 | `duplicateUrl.ts`、`duplicateUrlWarning.ts`と各単体テスト |
| 本日実装 | 重複画像検出 | `imageFingerprint.ts`、`imageDuplicateDetector.ts`と各単体テスト、`duplicate-image-detection.md` |
| 本日実装 | 画像順の調整 | `views/imageCandidateOrder.ts`、`views/__tests__/imageCandidateOrder.spec.ts`、`image-reordering.md` |

## 完了条件の確認

### 漫画以外の画像が選択されにくい

- URL構造、ファイル名の連番、DOM順、同一親要素、共通CSSクラス、画像寸法・縦横比を組み合わせて採点している。
- `logo`、`icon`、`avatar`、`banner`、`ad`などの装飾画像名を減点している。
- DOM構造だけでは初期選択せず、他の根拠との組み合わせを必須にしている。
- 再現ページでは、連番漫画3件と別親の広告1件から漫画3件だけを選択できた。
- 共通CSSクラスだけの大きな縦長画像3件は閾値未満となり、誤選択を防止できた。
- 実在するWikimedia Commonsの漫画カテゴリページでは、一覧画像77件を候補として表示しつつ初期選択を0件に抑えた。

### 同一作品の複数話をまとめやすい

- IndexedDBに保存済みの作品から既存作品候補を表示できる。
- ページタイトルから作品タイトルと話数の候補を生成できる。
- 新規作品、既存作品への話追加、単話保存の3登録モードを同じ保存フローで扱える。
- 各登録モードの単体テストで、候補値から保存までのデータ連携を確認している。

### 保存時の入力負担が減る

- 作品タイトル・話数の候補を入力欄へ反映できる。
- URL重複時に既存データの詳細を確認できる。
- 内容が同一の画像を保存前に警告し、ダイアログ内をスクロールして全件確認できる。
- 上下移動ボタンによる並び替えをプレビューへ即時反映し、保存後と閲覧時にも同じ順序を維持できる。
- 重複画像警告と画像順調整を含む保存処理は、3登録モードで共通して機能する。

## 保存方針の確認

- APIは取得したHTMLと画像を処理中だけメモリ上で扱い、ファイルやデータベースへ永続保存しない。
- Frontendの通信先は取得APIとAPI発行の画像中継URLに限定され、対象サイトへ直接通信しない。
- 漫画画像の永続保存先はFrontendのDexieによるIndexedDBだけである。
- APIログには取得元URL、HTML、DOM情報、画像内容、画像中継トークンを記録しない。

## 自動検証

- Backend：Ruff format、Ruff check、mypy成功、pytest 138件成功
- Frontend：Prettier、ESLint、型チェック成功、Vitest 50ファイル・305件成功、production build成功

## 結論

Step 4の残機能を含む10機能が実装され、誤選択の抑制、複数話登録の支援、保存入力・確認操作の削減を自動テストと再現確認で説明できる状態になった。要件定義書に記載されたStep 4の完了条件をすべて満たしている。
