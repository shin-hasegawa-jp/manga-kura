# 漫画蔵

## Dockerでのローカル開発

```shell
cp .env.example .env
docker compose -f compose.dev.yaml up --build
```

`.env`の`API_PROXY_TOKEN_SECRET`は起動前に変更してください。

- Frontend: http://127.0.0.1:17390
- API: http://127.0.0.1:17391

Web・APIは`127.0.0.1`にのみ公開します。ホスト側のポートは`.env`の`WEB_PORT`・`API_PORT`で変更でき、API接続先とCORS許可先も自動的に追従します。既存の`.env`で`VITE_FETCH_API_BASE_URL`・`API_CORS_ORIGINS`を指定している場合は、それらを削除して自動設定を使うか、新しいポートに合わせて更新してください。

複数プロジェクトでは、共通のポート台帳などで使用ポートを管理して重複を避けてください。同じプロジェクトの別worktreeを並行起動する場合も、各worktreeの`.env`でプロジェクト名と両方のポートを変えます。

```dotenv
COMPOSE_PROJECT_NAME=manga-kura-feature
WEB_PORT=17490
API_PORT=17491
```

Composeがコンテナ・ネットワーク・名前付きボリュームをプロジェクトごとに分離します。`container_name`やボリュームの固定`name`を追加せず、この分離を維持してください。プロジェクト名を変えると依存パッケージ用のボリュームも別になります。

停止するには次を実行します。

```shell
docker compose -f compose.dev.yaml down
```

停止は起動時と同じ`.env`・プロジェクト名で実行してください。プロジェクト名を変更する場合は、変更前に停止します。`down --volumes`は対象プロジェクトのボリュームも削除するため、通常の停止では指定しません。

作品・話・画像はブラウザのIndexedDBに保存されるため、コンテナを再作成しても削除されません。

IndexedDBはブラウザのオリジン（ホスト名・ポートを含む）ごとに分かれます。Webのポートを変更すると保存済み作品は新しいURLでは表示されず、元のURLにアクセスすると引き続き利用できます。この構成にDB・Redisコンテナはありません。

本番ではFrontendをAWSの静的ホスティングへ、APIイメージをECSへデプロイします。
