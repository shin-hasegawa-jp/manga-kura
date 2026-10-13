#!/usr/bin/env bash
# Invoked only by Production CD after verifying the same commit.
set -euo pipefail
: "${PROJECT_ID:?}" "${REGION:?}" "${SERVICE:?}" "${API_URL:?}" "${WEB_URL:?}" "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}" "${GITHUB_STEP_SUMMARY:?}"

service_json=$(mktemp)
trap 'rm -f "$service_json"' EXIT

gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" --format=json > "$service_json"
python3 - "$service_json" <<'PY'
import json, os, sys
service = json.load(open(sys.argv[1]))
if service['status']['url'].rstrip('/') != os.environ['API_URL'].rstrip('/'):
    raise SystemExit('GCP_API_URL does not match the existing Cloud Run service URL')
with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as out:
    out.write(f"## Production deployment\n\nCommit: `{os.environ['GITHUB_SHA']}`\n\n")
    out.write('Previous API traffic (restore all percentages together):\n\n```json\n')
    out.write(json.dumps(service['status'].get('traffic', []), indent=2))
    out.write('\n```\n\n')
PY

image="$REGION-docker.pkg.dev/$PROJECT_ID/manga-kura/api:$GITHUB_SHA"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
docker push "$image"
digest=$(gcloud artifacts docker images describe "$image" --project="$PROJECT_ID" --format='value(image_summary.digest)')
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
immutable_image="${image%:*}@$digest"
printf 'Image: `%s`\n\n' "$immutable_image" >> "$GITHUB_STEP_SUMMARY"

# Unique revision for retries; keep production traffic unchanged until /health passes.
suffix="cd-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
gcloud run deploy "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --image="$immutable_image" --revision-suffix="$suffix" --no-traffic --tag=cd-candidate --quiet
revision="$SERVICE-$suffix"
candidate_url=$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --format=json | python3 -c 'import json,sys; print(next(t["url"] for t in json.load(sys.stdin)["status"]["traffic"] if t.get("tag") == "cd-candidate"))')
[[ "$candidate_url" == https://* ]]
check_health() {
  curl --fail --silent --show-error --retry 5 --retry-delay 5 --retry-all-errors --max-time 30 "$1/health" \
    | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status") == "ok"'
}
check_health "${candidate_url%/}"
printf 'Candidate health passed: `%s`\n\n' "$revision" >> "$GITHUB_STEP_SUMMARY"
gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" --region="$REGION" \
  --to-revisions="$revision=100" --quiet
printf 'API promoted: `%s`\n\n' "$revision" >> "$GITHUB_STEP_SUMMARY"
check_health "${API_URL%/}"

# Record the last Hosting release before changing it; fail before publication if unavailable.
site=$(python3 -c 'import json,os; print(json.load(open("apps/web/.firebaserc"))["targets"][os.environ["PROJECT_ID"]]["hosting"]["prod"][0])')
access_token=$(gcloud auth print-access-token)
# Do not print credentials or enable shell tracing.
curl --fail --silent --show-error --max-time 30 \
  -H "Authorization: Bearer $access_token" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$site/releases?pageSize=1" \
  | python3 -c 'import json,os,sys; data=json.load(sys.stdin); out=open(os.environ["GITHUB_STEP_SUMMARY"],"a"); out.write("Previous Hosting release:\n\n```json\n"+json.dumps(data,indent=2)+"\n```\n\n")'
unset access_token
(cd apps/web && firebase deploy --only hosting:prod --project="$PROJECT_ID" --non-interactive \
  --message="GitHub $GITHUB_SHA / $GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT")
printf 'Hosting published for `%s`\n\n' "$GITHUB_SHA" >> "$GITHUB_STEP_SUMMARY"
curl --fail --silent --show-error --location --max-time 30 "${WEB_URL%/}/" > /dev/null
printf 'API health and Web HTTP checks passed. Browser parsing/image checks remain manual.\n' >> "$GITHUB_STEP_SUMMARY"
