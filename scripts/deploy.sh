#!/usr/bin/env bash
# Deploys the built web bundle (dist/) to Firebase Hosting:
#   deploy.sh dev | prod       live site (dev -> mon-farm-dev, prod -> mon-farm-prod)
#   deploy.sh preview <name>   temporary channel on the dev site, expires in 7 days
# Targets live in .firebaserc.
#
# The Deploy Prod workflow merges to main only after this exits 0, so it fails
# closed: any problem (bad argument, missing build, missing credential,
# firebase error) is a non-zero exit, never a silent pass.
#
# Credentials: locally, your own `firebase login`. In CI (CI=true) a service
# credential must come from the environment (GOOGLE_APPLICATION_CREDENTIALS,
# which firebase-tools reads itself). Nothing is committed.
set -euo pipefail

env="${1:-}"
channel="${2:-}"
case "$env" in
  dev | prod) ;;
  preview)
    if ! [[ "$channel" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
      echo "deploy.sh: preview needs a channel name like pr-12" >&2; exit 2
    fi ;;
  *) echo "usage: deploy.sh dev|prod|preview <name>" >&2; exit 2 ;;
esac

if [ ! -f dist/index.html ]; then
  echo "deploy.sh: dist/index.html not found - run 'npm run build:web' first" >&2
  exit 1
fi

if [ "${CI:-}" = "true" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  echo "deploy.sh: CI deploy needs GOOGLE_APPLICATION_CREDENTIALS (service credential)" >&2
  exit 1
fi

# firebase.json plus one rewrite per dynamic route in dist/ (see
# hosting-config.mjs); written next to firebase.json so its relative paths hold.
node "$(dirname "$0")/hosting-config.mjs"

if command -v firebase >/dev/null 2>&1; then
  firebase=(firebase)
else
  firebase=(npx --yes firebase-tools@15.31.0)
fi

if [ "$env" = "preview" ]; then
  "${firebase[@]}" hosting:channel:deploy "$channel" --only dev --expires 7d --non-interactive --config firebase.deploy.json
else
  "${firebase[@]}" deploy --only "hosting:$env" --non-interactive --config firebase.deploy.json
fi
