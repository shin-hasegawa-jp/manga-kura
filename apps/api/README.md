# 漫画蔵 取得専用API

公開ページのHTML解析と画像の一時中継を行うFastAPIアプリです。

## エンドポイント

- `GET /health`: 稼働確認
- `POST /v1/pages/analyze`: ページを解析して画像候補と短寿命の中継トークンを返す
- `GET /v1/images/proxy?token=...`: トークンに対応する画像を中継する

## ローカル開発

`apps/api`で実行します。

```shell
uv sync
uv run fastapi dev main.py
```

環境変数の例は`.env.example`を参照してください。`API_PROXY_TOKEN_SECRET`は環境ごとに十分長いランダム値を設定します。

## 検証

```shell
uv run ruff check . --fix
uv run ruff format .
uv run mypy .
uv run pytest
```

取得先は公開HTTP(S)に限定し、内部・ローカルアドレスへの接続を拒否します。取得したURL、HTML、画像、トークンはログや永続ストレージへ保存しません。
