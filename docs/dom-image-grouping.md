# DOM画像グループ判定

## 現行フロー

1. APIの`image_candidate_extractor.py`がHTMLから画像URL、DOM順、抽出元属性を取り出す。
2. `page_analyzer.py`が画像中継トークンを付与する。
3. `pages.py`がPydanticレスポンスへ変換する。
4. Frontendの`acquisitionApiSchemas.ts`がレスポンスを検証する。
5. `imageCandidateFactory.ts`が画面用候補を生成する。
6. `imageCandidateScorer.ts`がURL、連番、DOM順、寸法、縦横比、装飾ファイル名を採点する。

## 今回の責務

- APIは画像要素の同じ親要素と共通CSSクラスを比較できる最小限の情報を抽出する。
- API契約は親グループIDとCSSクラスを上限付きで返す。
- FrontendはDOM情報を既存の判定材料と組み合わせ、デフォルト選択を決める。
- HTML、セレクター全文、任意属性値はレスポンスやログへ含めない。

## 変更対象

- API抽出：`apps/api/app/services/image_candidate_extractor.py`
- API契約：`apps/api/app/schemas.py`、`apps/api/app/api/routes/pages.py`
- Frontend契約：`apps/web/src/services/acquisitionApiSchemas.ts`
- 候補モデル：`apps/web/src/services/imageCandidateFactory.ts`
- 採点：`apps/web/src/services/imageCandidateScorer.ts`
- 上記に対応するAPI・Frontend単体テスト

## 判定方針

- 同じ直接の親要素に複数の画像がある場合だけ親グループとして扱う。
- CSSクラスは画像要素自身に付与されたクラスだけを比較し、3件以上に共通する場合だけ採点する。
- DOM構造だけでは初期選択を確定せず、連番、URL、寸法などの既存根拠と組み合わせる。
- 大きな共通コンテナや汎用クラスによる広告・ロゴの巻き込みを避ける。

## 確認結果

### 再現用HTML

| ケース | 変更前 | 変更後 | 結果 |
|---|---:|---:|---|
| 異なるURL配下にある同一親の大きな縦長画像2件 | 各35点・0件選択 | 各50点・2件選択 | 親グループを根拠に漫画候補として選択 |
| 共通CSSクラスだけを持つ大きな縦長画像3件 | 各35点・0件選択 | 各45点・0件選択 | CSSクラスだけでは自動選択しない |
| 連番漫画3件と別親の広告1件 | 漫画3件を選択 | 漫画3件を選択 | 広告を親・クラスグループへ巻き込まない |
| DOM情報なしの連番画像 | 漫画画像を選択 | 漫画画像を選択 | 既存レスポンス相当でも判定を維持 |

### 実在サイト

2026-07-25にWikimedia Commonsの`Category:Manga`をローカル結合環境から解析した。

- API経由で77件の候補をDOM順に表示できた。
- 漫画ページではなくカテゴリ一覧であるため、初期選択は0件となった。
- 画面内のプレビュー成功と失敗が候補ごとに分離して表示された。
- 全選択で77件、全解除で0件へ戻り、既存の一括選択操作を維持した。
- APIログにはリクエストメソッド、APIパス、エラーコードだけが記録され、取得元URL、DOM情報、トークン、画像内容は記録されなかった。

### 自動検証

- Backend：Ruff format、Ruff check、mypy、pytest 134件成功
- Frontend：Prettier、ESLint、型チェック、Vitest 268件成功、production build成功
