# API開発ルール

## ローカルサーバー起動コマンド

- 開発サーバー: `uv run fastapi dev main.py`

上記は`apps/api`で実行する。

## 検証コマンド

- Lint（Ruff・自動修正）: `uv run ruff check . --fix`
- Format（自動整形）: `uv run ruff format .`
- 型チェック: `uv run mypy .`
- 単体テスト: `uv run pytest`

`apps/api`を変更したら、上記の検証コマンドをすべて実行し、正常終了を確認する。
