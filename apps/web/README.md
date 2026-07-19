# 漫画蔵 Frontend

作品・話・画像をブラウザのIndexedDBへ保存して閲覧するVue SPAです。本番成果物はAWSの静的ホスティングへ配置します。

## ローカル開発

`apps/web`で実行します。

```shell
npm ci
npm run dev
```

取得APIの接続先は`VITE_FETCH_API_BASE_URL`で指定します。ブラウザから到達できるURLを設定してください。この値はproduction build時に成果物へ組み込まれます。

## 検証

```shell
npm run format
npm run lint
npm run type-check
npm run test:unit
npm run build
```
