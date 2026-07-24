# 保存フロー性能調査

## 現行フロー

### プレビュー

1. `SaveView.vue`が`analyzePageImages`を呼び出す
2. Frontendが`POST /v1/pages/analyze`へ対象ページURLを送る
3. APIがHTMLを取得し、画像候補を抽出してプレビュー用・保存用トークンを発行する
4. Frontendが各候補のプレビュー用トークンで`GET /v1/images/proxy`を呼び出す
5. APIが取得元画像をストリーミングし、ブラウザが候補カードへ表示する

### 保存

1. `SaveView.vue`が選択候補と登録情報を`saveAnalyzedPage`へ渡す
2. `imageBlobClient.ts`が各候補の保存用トークンで`GET /v1/images/proxy`を呼び出す
3. APIが取得元画像をストリーミングする
4. FrontendがレスポンスをBlob化し、不足している画像寸法を取得する
5. `registrationService.ts`が作品・話・画像を1つのIndexedDBトランザクションで登録する

## 責務と主な確認箇所

| 区間 | 責務 | 主な実装 |
|---|---|---|
| HTML取得・候補抽出 | API | `page_html_fetcher.py`、`page_analyzer.py` |
| 取得元へのアクセス間隔 | API | `rate_limiter.py`、`external_http_client.py` |
| 画像ストリーミング・上限検査 | API | `image_proxy.py`、`proxy_usage_tracker.py` |
| プレビュー要求・表示 | Frontend | `SaveView.vue`、`acquisitionApiClient.ts` |
| 保存画像の取得・Blob化 | Frontend | `imageBlobClient.ts`、`saveAnalyzedPage.ts` |
| IndexedDB登録 | Frontend | `registrationService.ts`、`repository.ts` |

## 維持する制約

- APIへURL、HTML、画像、トークンを永続保存しない
- SSRF対策、リダイレクト検査、画像件数・単体サイズ・合計サイズ制限を維持する
- 取得元ドメインへのアクセス間隔を維持し、瞬間的な過負荷を避ける
- 画像取得が一部でも失敗した場合は登録を開始せず、再試行時は取得済み画像を再利用する
- 作品・話・画像のIndexedDB登録は同一トランザクションで行う

## 調査の進め方

少数画像（3件）と多数画像（20件）を同じ取得元・同じ通信条件で各3回実行し、中央値を比較する。ブラウザではページ解析、先頭プレビュー、主要プレビュー、全プレビュー、保存画像取得、IndexedDB登録を分ける。APIでは取得元アクセス間隔の待機とレスポンスのストリーミングを分け、取得元やネットワーク由来の時間をアプリ内部処理と混同しない。
