# GCP Production CD

## 方針

毎回のコマンド入力をなくし、GitHub Actions で同じコミットの Web/API 検証・ビルド・公開を行う。本番 1 環境＋ローカルを継続する。初期版は `main` の `workflow_dispatch` のみ。実デプロイ・再実行・復旧の確認後、別 PR で `main` push による自動実行を追加する。

`release/* → main` の運用を維持する。Web/API CI を develop・release/*・main の push/PR、および CD からの workflow_call に対応させる。CD は同じコミットの CI 成功後だけ公開する。PR の CI には GCP 認証を渡さない。

API runtime を linux/amd64 でビルドし、SHA タグで push、digest で Cloud Run に指定する。既存サービスのイメージだけを更新し、実行 SA、署名鍵のバージョン、CORS、リソース設定、公開 IAM は維持する。これらの設定変更・鍵ローテーションは別作業。

トラフィックなしの新 API リビジョンを `cd-candidate` タグで作り、タグ URL の `/health` を確認してから本番トラフィックを切り替える。その後 `hosting:prod` のみ公開する。API は旧 Web/PWA と互換性を保つ。双方の公開は原子的ではなく、失敗時の自動ロールバックは行わない。

本番実行は直列化し、進行中の実行をキャンセルしない。GitHub concurrency は FIFO キューではないため、先の実行完了を待って次を実行する。復旧中は新規 CD を実行しない。

## 初期設定（管理者が一度だけ実施）

この PR はクラウドを変更しない。以下は管理者用の設定手順。既存の本番プロジェクト・サービスを確認して実行する。長期 SA 鍵や FIREBASE_TOKEN は発行しない。

1. GitHub Environment `production` を作成し、Deployment branches を `main` のみにする。main への直接 push を禁止し、release PR の Web/API CI を必須チェックにする。
2. 専用デプロイ SA、WIF pool/provider を作成する。既にある場合は再作成せず設定を確認する。

```bash
export PROJECT_ID="manga-kura"
export REGION="asia-northeast1"
export SERVICE="実際の本番サービス名"
export RUNTIME_SA="実際のAPI実行SAのメールアドレス"
export REPOSITORY_ID="GitHubリポジトリの数値ID"
export OWNER_ID="GitHub所有者の数値ID"
export DEPLOY_SA="manga-kura-cd@$PROJECT_ID.iam.gserviceaccount.com"
# ID は gh api repos/shin-hasegawa-jp/manga-kura --jq '{repository_id: .id, owner_id: .owner.id}' で確認。

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT_ID"
gcloud iam service-accounts create manga-kura-cd --project="$PROJECT_ID"
gcloud iam workload-identity-pools create github-cd --project="$PROJECT_ID" --location=global
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam workload-identity-pools providers create-oidc github \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github-cd \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id" \
  --attribute-condition="assertion.repository_owner_id == '$OWNER_ID' && assertion.repository_id == '$REPOSITORY_ID' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'shin-hasegawa-jp/manga-kura/.github/workflows/production-cd.yml@refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-cd/attribute.repository_id/$REPOSITORY_ID"
```

3. デプロイ SA に必要な権限を付与する。Owner/Editor、Secret Accessor は付けない。Cloud Run の公開 IAM は初回構築済みを前提とする。

```bash
gcloud run services add-iam-policy-binding "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/run.developer
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project="$PROJECT_ID" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser
gcloud artifacts repositories add-iam-policy-binding manga-kura --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer
for role in roles/firebasehosting.admin roles/serviceusage.apiKeysViewer roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SA" --role="$role"
done
```

Hosting 権限はプロジェクト内の他サイトにも及ぶ。workflow の `hosting:prod` 指定は IAM 境界ではない。API の実行 SA と CD 用 SA は別にし、実行 SA の既存 Secret Accessor は維持する。

4. `production` の **Variables** に次を登録する。秘密鍵の値は登録しない。

| Variable | 値 |
|---|---|
| GCP_PROJECT_ID | `manga-kura`（`.firebaserc` の prod 対応と一致） |
| GCP_RUN_SERVICE | 既存の本番 Cloud Run サービス名 |
| GCP_API_URL | サービスの `status.url`（HTTPS オリジン） |
| GCP_WEB_URL | 本番画面の HTTPS オリジン。独自ドメインも可 |
| GCP_WIF_PROVIDER | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-cd/providers/github` |
| GCP_DEPLOY_SERVICE_ACCOUNT | `manga-kura-cd@PROJECT_ID.iam.gserviceaccount.com` |

API はタグ URL でも公開呼び出し可能であることが必要。新リビジョンも既存サービスの公開設定を継承する。`cd-candidate` は次の実行で付け替わるため、候補 URL をフロント設定に使わない。

## 実行

この変更を develop にマージ後、通常の release PR で main に反映する。workflow_dispatch はデフォルトブランチにも workflow が存在する必要がある。

Actions → Production CD → Run workflow → **main** を選択する。main 以外は CI・公開をスキップする。Summary にコミット、digest、旧 API トラフィック、候補確認、本番切替、旧 Hosting リリース、Web 公開の到達点を記録する。同じ SHA の再実行でもリビジョン名は run ID/attempt で区別する。

API が先に切り替わるため、Hosting 前のエラーも部分公開として扱う。Hosting リリース履歴取得や Web HTTP 確認に失敗しても、API/Hosting が既に公開されている場合がある。再実行前に Summary、Cloud Run、Hosting の状態を確認する。外部キャンセル時もクラウド側の処理が完了している可能性がある。

## 復旧

API: Summary の Previous API traffic を確認し、タグのみの項目は除外して、**旧リビジョン名と全割合**を同時に指定する。`latestRevision: true` の項目も、記録された revisionName を指定する。`--to-latest` は使わない。

```bash
gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --to-revisions="記録された旧リビジョン名=100"
```

分割配信だった場合は `旧リビジョンA=割合,旧リビジョンB=割合` とする。復旧した API の `/health` と実ブラウザ動作を確認する。

Web: Firebase コンソール → Hosting → 本番サイト → リリース履歴で、Summary に記録された旧 version/release と一致するリリースへロールバックする。PWA/既存タブは即時に切り替わらないため、更新後と旧画面の互換性も確認する。

## 受入確認と証拠の範囲

- workflow の構文・shell 静的検査、デプロイスクリプトの模擬試験を行う。
- GCP 設定後、main の手動実行・再実行・API/Hosting 復旧を実環境で確認する。
- CD の `/health` と Web HTTP 成功は疎通確認。実ブラウザの表示、ページ解析、画像取得、CORS、PWA 更新は別に確認する。
- 実環境確認が済むまでは main push の自動実行を追加しない。

## 参考

- [WIF deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
- [Firebase CLI の ADC](https://firebase.google.com/docs/cli)
- [Firebase Hosting の権限](https://firebase.google.com/docs/projects/iam/roles-predefined-product)
