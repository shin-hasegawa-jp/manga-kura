# 漫画蔵

## Dockerでのローカル開発

```shell
cp .env.example .env
docker compose -f compose.dev.yaml up --build
```

`.env`の`API_PROXY_TOKEN_SECRET`は起動前に変更してください。

- Frontend: http://127.0.0.1:17390
- API: http://127.0.0.1:17391

停止するには次を実行します。

```shell
docker compose -f compose.dev.yaml down
```

作品・話・画像はブラウザのIndexedDBに保存されるため、コンテナを再作成しても削除されません。

本番ではFrontendをAWSの静的ホスティングへ、APIイメージをECSへデプロイします。
