# 漫画蔵 取得専用API

Frontendから直接取得できない公開ページのHTML解析と画像の一時中継を行うFastAPIアプリです。取得したHTML・画像は永続保存しません。

## 開発環境

- 配置: `apps/api`
- Python: 3.13（`.python-version`で固定）
- 依存関係管理: `uv`
- ASGIエントリーポイント: `main.py`の`app`
- ローカルFrontend: `apps/web`

依存バージョン条件は`pyproject.toml`を正とします。現在の直接依存は次のとおりです。

- `fastapi[standard-no-fastapi-cloud-cli]>=0.128.8`
- `beautifulsoup4>=4.15.0`
- `mypy>=1.19.1`
- `pytest>=8.4.2`
- `pytest-asyncio>=1.2.0`
- `respx>=0.23.1`
- `ruff>=0.15.22`
- `types-beautifulsoup4>=4.12.0.20250516`

FastAPIのstandard extraから`uvicorn`、`httpx`、`pydantic`、`pydantic-settings`を利用します。これらは個別の直接依存として追加しません。

## コマンド

`apps/api`で実行します。

```shell
uv run fastapi dev main.py
uv run ruff check . --fix
uv run ruff format .
uv run mypy .
uv run pytest
```

## 配置方針

レビュー単位29以降では次の構成へ移行します。`main.py`にはアプリ生成と起動に必要な公開境界だけを置き、取得処理をルートへ直接実装しません。

```text
apps/api/
├── main.py
├── app/
│   ├── config.py
│   ├── errors.py
│   ├── schemas.py
│   ├── api/
│   │   └── routes/
│   │       ├── health.py
│   │       ├── pages.py
│   │       └── images.py
│   └── services/
│       ├── url_validator.py
│       ├── external_http_client.py
│       ├── page_analyzer.py
│       └── image_proxy.py
└── tests/
```

ルート層はPydanticスキーマとの変換とHTTPステータスの決定だけを担当します。URL検証、外部取得、HTML解析、画像中継はサービス層へ分離し、外部HTTPクライアントとDNS解決をテスト時に差し替えられる境界にします。

## API契約

APIのベースパスは`/v1`とします。JSONのフィールド名はcamelCaseで統一します。

### `GET /health`

依存先へアクセスせず、APIプロセスの稼働状態だけを返します。

成功レスポンス（200）:

```json
{
  "status": "ok"
}
```

Pydanticモデル:

```text
HealthResponse
- status: Literal["ok"]
```

### `POST /v1/pages/analyze`

公開ページのHTMLを取得して画像候補をDOM順に返します。画像本体やHTML本文はレスポンスへ含めません。

リクエスト:

```json
{
  "url": "https://example.com/comic/1"
}
```

成功レスポンス（200）:

```json
{
  "pageUrl": "https://example.com/comic/1",
  "acquisitionMethod": "api",
  "candidates": [
    {
      "id": "image-candidate-0",
      "domOrder": 0,
      "imageUrl": "https://cdn.example.com/images/page-001.jpg",
      "sourceAttribute": "src",
      "proxyToken": "opaque-short-lived-token"
    }
  ]
}
```

Pydanticモデル:

```text
AnalyzePageRequest
- url: HttpUrl

ImageCandidateResponse
- id: str
- dom_order: int (0以上)
- image_url: HttpUrl
- source_attribute: Literal["src", "srcset", "data-src", "data-original", "data-lazy-src", "data-original-src", "data-lazy", "data-srcset"]
- proxy_token: str

AnalyzePageResponse
- page_url: HttpUrl
- acquisition_method: Literal["api"]
- candidates: list[ImageCandidateResponse]
```

候補0件は通信・解析失敗ではないため、200と空の`candidates`を返します。候補IDはレスポンス内で一意とし、`domOrder`の昇順に並べます。`proxyToken`は対象画像URL、解析バッチID、候補ID、有効期限をHMAC署名し、生のURLを画像中継APIの入力にしません。トークンは単回利用とし、同じ解析バッチ内で最大100枚・合計200 MiBまで中継できます。

### `GET /v1/images/proxy?token=...`

解析APIが発行した短寿命の`proxyToken`に対応する画像だけを取得し、そのContent-Typeを維持してストリーミングします。画像本体をディスク、DB、ログへ保存しません。

成功レスポンス（200）:

- Body: 画像バイナリ
- `Content-Type`: 検証済みの`image/*`
- `Content-Length`: 判明しており上限内の場合だけ付与
- `Cache-Control: no-store`

期限切れ・改ざん済みトークンは400、許可されない取得先は403、取得先の失敗は502、タイムアウトは504として共通エラーを返します。

## 共通エラー

JSONエラーは次の形で統一します。公開レスポンスには取得URL、クエリ文字列、HTML本文、画像内容、内部例外を含めません。

```json
{
  "error": {
    "code": "upstream_timeout",
    "message": "取得先が時間内に応答しませんでした。",
    "retryable": true,
    "details": null
  }
}
```

Pydanticモデル:

```text
ApiErrorDetail
- code: str
- message: str
- retryable: bool
- details: dict[str, str | int | bool] | None

ApiErrorResponse
- error: ApiErrorDetail
```

エラーコードは少なくとも`invalid_url`、`forbidden_destination`、`upstream_http_error`、`upstream_network_error`、`upstream_timeout`、`unsupported_content_type`、`unsupported_character_encoding`、`response_too_large`、`too_many_candidates`、`invalid_proxy_token`、`rate_limited`、`internal_error`を定義します。

## 設定と上限値

設定は`pydantic-settings`で環境変数から読み込み、次を初期値とします。実装時はテストから設定を差し替えられるようにします。

| 環境変数 | 初期値 | 用途 |
| --- | ---: | --- |
| `API_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | 許可するFrontendオリジン |
| `API_CONNECT_TIMEOUT_SECONDS` | `5` | 接続タイムアウト |
| `API_READ_TIMEOUT_SECONDS` | `10` | 読み取りタイムアウト |
| `API_TOTAL_TIMEOUT_SECONDS` | `15` | 1取得の全体タイムアウト |
| `API_MAX_REDIRECTS` | `5` | リダイレクト上限 |
| `API_MAX_RESPONSE_HEADER_BYTES` | `65536` | レスポンスヘッダー最大64 KiB |
| `API_MAX_HTML_BYTES` | `5242880` | HTML最大5 MiB |
| `API_MAX_IMAGE_BYTES` | `20971520` | 1画像最大20 MiB |
| `API_MAX_IMAGE_COUNT` | `100` | 1解析・保存の最大画像数 |
| `API_MAX_TOTAL_IMAGE_BYTES` | `209715200` | 1保存の合計最大200 MiB |
| `API_PROXY_TOKEN_TTL_SECONDS` | `900` | 中継トークン有効期間15分 |
| `API_PROXY_TOKEN_SECRET` | `local-development-only-change-me` | HMAC署名鍵。本番では長いランダム値へ必ず変更 |
| `API_RATE_LIMIT_REQUESTS` | `30` | 制限期間内のクライアント別上限 |
| `API_RATE_LIMIT_WINDOW_SECONDS` | `60` | レート制限期間 |
| `API_DOMAIN_INTERVAL_SECONDS` | `1` | 同一ドメインへの最小アクセス間隔 |

上限値はAPIレスポンスへ常時露出させません。上限超過時は共通エラーの`code`で判別可能にします。

## CORS

開発時は`http://127.0.0.1:5173`と`http://localhost:5173`だけを許可します。

- `allow_credentials`: `false`
- `allow_methods`: `GET`、`POST`
- `allow_headers`: `Content-Type`
- 公開環境: `API_CORS_ORIGINS`で明示したオリジンだけを許可
- ワイルドカード`*`は使用しない

画像中継レスポンスにも同じCORSポリシーを適用します。

## Frontendとの接続

Frontendはまず従来の直接取得を試し、CORSを含む通信失敗時だけ`POST /v1/pages/analyze`へフォールバックします。APIレスポンスはValibotで検証し、`ImageCandidateResponse`をFrontendの既存`ImageCandidate`へ次のように変換します。

- `id`、`domOrder`、`imageUrl`、`sourceAttribute`: API値を引き継ぐ
- `fetchStatus`: `idle`
- `isSelected`: `false`
- `score`: `0`
- `selectionReasons`: 空配列
- サイズ取得とデフォルト選択: 既存Frontend処理を再利用
- Blob取得: API候補では`proxyToken`を使う画像中継APIへ切り替える

開発時のAPI URLはFrontend環境変数から`http://127.0.0.1:8000`を指定し、本番URLをコードへ固定しません。
