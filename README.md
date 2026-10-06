# 漫画蔵

## Dockerでのローカル開発

```shell
cp .env.example .env
docker compose -f compose.dev.yaml up --build
```

`.env`の`API_PROXY_TOKEN_SECRET`は起動前に変更してください。

- Frontend: http://127.0.0.1:17390
- API: http://127.0.0.1:17391

Web・APIは`127.0.0.1`にのみ公開します。並行開発では、各プロジェクト・worktreeの`.env`で`COMPOSE_PROJECT_NAME`・`WEB_PORT`・`API_PORT`を重複しない値に変更してください。API接続先とCORS許可先はポートから自動設定され、コンテナ・ネットワーク・ボリュームもプロジェクトごとに分離されます。

停止するには次を実行します。

```shell
docker compose -f compose.dev.yaml down
```

プロジェクト名を変更する前に、起動時と同じ設定で停止してください。

作品・話・画像はブラウザのIndexedDBに保存されます。コンテナの再作成では削除されませんが、Webのポートを変えると保存先が分かれます。

本番ではFrontendをAWSの静的ホスティングへ、APIイメージをECSへデプロイします。
