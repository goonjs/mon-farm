#!/usr/bin/env bash
# Deploys the built web bundle (dist/) to Firebase Hosting:
#   deploy.sh dev | prod       live site (dev -> mon-farm-dev, prod -> mon-farm-prod)
#   deploy.sh preview <name>   temporary channel on the dev site, expires in 7 days
#   deploy.sh preview-delete <name>   remove that channel (PR closed); a channel
#                              that is already gone is success, not an error
# Targets live in .firebaserc. Channel commands take a site, not a target, so
# the dev site id is repeated below (a test keeps the two in step).
#
# The Deploy Prod workflow merges to main only after this exits 0, so it fails
# closed: any problem (bad argument, missing build, missing credential,
# firebase error) is a non-zero exit, never a silent pass.
#
# Credentials: locally, your own `firebase login`. In CI (CI=true) a service
# credential must come from the environment (GOOGLE_APPLICATION_CREDENTIALS,
# which firebase-tools reads itself). Nothing is committed.
set -euo pipefail

dev_site=mon-farm-dev

env="${1:-}"
channel="${2:-}"
case "$env" in
  dev | prod) ;;
  preview | preview-delete)
    if [ "$channel" = "live" ]; then
      echo "deploy.sh: refusing to touch the live channel" >&2; exit 2
    fi
    if ! [[ "$channel" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]]; then
      echo "deploy.sh: preview needs a channel name like pr-12" >&2; exit 2
    fi ;;
  *) echo "usage: deploy.sh dev|prod|preview <name>|preview-delete <name>" >&2; exit 2 ;;
esac

if [ "$env" != "preview-delete" ] && [ ! -f dist/index.html ]; then
  echo "deploy.sh: dist/index.html not found - run 'npm run build:web' first" >&2
  exit 1
fi

if [ "${CI:-}" = "true" ] && [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  echo "deploy.sh: CI deploy needs GOOGLE_APPLICATION_CREDENTIALS (service credential)" >&2
  exit 1
fi

if command -v firebase >/dev/null 2>&1; then
  firebase=(firebase)
else
  firebase=(npx --yes firebase-tools@15.31.0)
fi

if [ "$env" = "preview-delete" ]; then
  # List first: deleting a channel that never existed (docs-only PR) or that
  # Firebase already expired is an error in firebase-tools, but not here.
  list=$("${firebase[@]}" hosting:channel:list --site "$dev_site" --json)
  if ! grep -Eq "/channels/${channel}\"" <<<"$list"; then
    echo "deploy.sh: no channel $channel on $dev_site - nothing to delete"
    exit 0
  fi
  "${firebase[@]}" hosting:channel:delete "$channel" --site "$dev_site" --force
elif [ "$env" = "preview" ]; then
  "${firebase[@]}" hosting:channel:deploy "$channel" --only dev --expires 7d --non-interactive
else
  "${firebase[@]}" deploy --only "hosting:$env" --non-interactive
fi
