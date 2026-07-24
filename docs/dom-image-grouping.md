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
- CSSクラスは画像要素自身に付与されたクラスだけを比較する。
- DOM構造だけでは初期選択を確定せず、連番、URL、寸法などの既存根拠と組み合わせる。
- 大きな共通コンテナや汎用クラスによる広告・ロゴの巻き込みを避ける。
