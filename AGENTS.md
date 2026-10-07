# プロジェクト共通ルール

## コミュニケーション

- ユーザーとのコミュニケーション、コードレビューの説明、開発メモは日本語で行う。

## GitHub CLI

- `gh`で認証・接続エラーが出た場合、再認証を依頼する前に権限付きで`gh auth status -h github.com`を再確認する。

## Cloud Agent

Node.js 24.15.0、uv 0.11.28、Python 3.13 は `/usr/local/bin` にある。`bash -l` は `/etc/profile.d/dev-toolchain-path.sh` でこのディレクトリを PATH の先頭に置く。非ログインのシェルでは `/exec-daemon/node`（v22.14）が先に解決され、`apps/web` の `engines` を満たさない。そのときは次を実行してから npm と uv を使う。

```shell
export PATH="/usr/local/bin:$PATH"
```

- Web の依存関係は `apps/web` で `npm ci`。API の依存関係は `apps/api` で `uv sync --locked --dev`。
- 起動時に Web（http://127.0.0.1:17390）と API（http://127.0.0.1:17391）が tmux セッション `manga-kura-web` と `manga-kura-api` で立ち上がる。ログは `/tmp/manga-kura-web.log` と `/tmp/manga-kura-api.log`。
- `API_PROXY_TOKEN_SECRET` は起動スクリプトが `~/.manga-kura-dev.env` に書く。リポジトリには置かない。
- 検証コマンドは `apps/web/AGENTS.md` と `apps/api/AGENTS.md` を使う。
