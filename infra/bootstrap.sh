#!/usr/bin/env bash
# Creates (or tops up) the household Firebase project and wires each app repo for keyless CI deploys.
# Safe to re-run: every step checks before it creates. Add a new PWA by appending to APPS and re-running.
#
# Prerequisites (once per machine):
#   npx firebase-tools login        # same Google account gcloud uses
#   gcloud auth login               # owner of the project after step 1
#   gh auth login                   # admin on the app repos
set -euo pipefail

PROJECT=huishouden-piekstra
GITHUB_OWNER=piekstra
POOL=github
PROVIDER=github
SA_NAME=github-deploy
# repo:hosting-site:web-app-display-name (empty display name = no Firebase web app, e.g. the portal needs no Auth)
APPS=(
  "huishouden:huishouden-piekstra:"
  "household-spending:huishouden-spending:Spending"
)
# Other apps' repos are wired by whoever owns them; this script only manages the repos listed
# above. The huishouden-tasks site and "Tasks" web app already exist in the project for the
# tasks app to adopt.

firebase() { npx --yes firebase-tools@14 "$@"; }
step() { printf '\n== %s\n' "$*"; }

step "Firebase project $PROJECT"
if ! gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  firebase projects:create "$PROJECT" --display-name "Huishouden" || true
fi
if ! firebase projects:list --json | jq -e --arg p "$PROJECT" '.result[] | select(.projectId == $p)' >/dev/null; then
  gcloud services enable firebase.googleapis.com --project "$PROJECT"
  # 403 here on a project you own means this Google account has not accepted the Firebase terms:
  # open https://console.firebase.google.com, choose "Add project" > this project, accept, re-run.
  firebase projects:addfirebase "$PROJECT"
fi
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')

step "APIs"
gcloud services enable --project "$PROJECT" \
  firebasehosting.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  identitytoolkit.googleapis.com sheets.googleapis.com drive.googleapis.com

step "Deploy service account"
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" --display-name "GitHub Actions deploy"
for role in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer roles/serviceusage.apiKeysViewer roles/run.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$role" --condition None >/dev/null
done
echo "$SA"

step "Workload Identity Federation (GitHub OIDC, owner $GITHUB_OWNER only)"
gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" --location global --workload-identity-pool "$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global \
       --workload-identity-pool "$POOL" --display-name "GitHub" \
       --issuer-uri "https://token.actions.githubusercontent.com" \
       --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
       --attribute-condition "assertion.repository_owner == '$GITHUB_OWNER'"
WIF_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$PROVIDER"

for entry in "${APPS[@]}"; do
  IFS=: read -r repo site app_name <<<"$entry"
  step "$repo → $site.web.app"

  if [[ "$site" != "$PROJECT" ]]; then
    firebase hosting:sites:get "$site" --project "$PROJECT" >/dev/null 2>&1 \
      || firebase hosting:sites:create "$site" --project "$PROJECT"
  fi

  # Only main-branch runs of this one repo may impersonate the deploy account.
  gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
    --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_OWNER/$repo" >/dev/null

  if ! gh repo view "$GITHUB_OWNER/$repo" >/dev/null 2>&1; then
    echo "repo $GITHUB_OWNER/$repo not found; skipping variables"
    continue
  fi
  gh variable set GCP_WIF_PROVIDER --repo "$GITHUB_OWNER/$repo" --body "$WIF_PROVIDER"
  gh variable set GCP_DEPLOY_SA --repo "$GITHUB_OWNER/$repo" --body "$SA"

  if [[ -n "$app_name" ]]; then
    app_id=$(firebase apps:list WEB --project "$PROJECT" --json | jq -r --arg n "$app_name" '.result[] | select(.displayName == $n) | .appId' | head -1)
    if [[ -z "$app_id" ]]; then
      app_id=$(firebase apps:create WEB "$app_name" --project "$PROJECT" --json | jq -r '.result.appId')
    fi
    # Web SDK config is public by design (it ships in the bundle); access is enforced by Auth and rules.
    config=$(firebase apps:sdkconfig WEB "$app_id" --project "$PROJECT" --json | jq '.result.sdkConfig')
    gh variable set VITE_FIREBASE_API_KEY --repo "$GITHUB_OWNER/$repo" --body "$(jq -r .apiKey <<<"$config")"
    # The project's default auth domain is the only redirect URI the auto-created OAuth client allows;
    # using the app's own domain needs its /__/auth/handler added to that client in the console.
    gh variable set VITE_FIREBASE_AUTH_DOMAIN --repo "$GITHUB_OWNER/$repo" --body "$PROJECT.firebaseapp.com"
    gh variable set VITE_FIREBASE_PROJECT_ID --repo "$GITHUB_OWNER/$repo" --body "$PROJECT"
    gh variable set VITE_FIREBASE_APP_ID --repo "$GITHUB_OWNER/$repo" --body "$app_id"
    gh variable set VITE_FIREBASE_MESSAGING_SENDER_ID --repo "$GITHUB_OWNER/$repo" --body "$(jq -r .messagingSenderId <<<"$config")"
  fi
done

step "Auth authorized domains"
# Firebase Auth only accepts sign-ins from listed domains. Needs Auth initialised (console step 1).
AUTH_API="https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config"
auth_headers=(-H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: $PROJECT")
current=$(curl -s "${auth_headers[@]}" "$AUTH_API")
if jq -e '.authorizedDomains' >/dev/null <<<"$current"; then
  wanted=$(for entry in "${APPS[@]}"; do IFS=: read -r _ site _ <<<"$entry"; echo "$site.web.app"; done)
  domains=$(jq -c --arg w "$wanted" '(.authorizedDomains + ($w | split("\n") | map(select(. != "")))) | unique' <<<"$current")
  curl -s -X PATCH "${auth_headers[@]}" -H "Content-Type: application/json" \
    "$AUTH_API?updateMask=authorizedDomains" -d "{\"authorizedDomains\": $domains}" | jq -c '.authorizedDomains'
else
  echo "Auth not initialised yet; do console step 1, then re-run."
fi

step "Done"
cat <<EOF
Manual steps the APIs don't cover (Firebase console, project $PROJECT):
  1. Authentication > Get started > Sign-in method > Google > Enable
     (initialises Auth on the free plan and creates the OAuth web client; no supported API does either)
  2. Google Auth Platform > Audience > Test users > add every household member's Google account
EOF
