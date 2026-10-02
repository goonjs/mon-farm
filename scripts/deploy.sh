#!/usr/bin/env bash
# Deploys the built web bundle (dist/) to an environment: `dev` or `prod`.
#
# NOT WIRED YET. The hosting target is undecided (docs/architecture.md,
# "Deployment / environments"). This fails closed on purpose: the Deploy Prod
# workflow merges to main only after this exits 0, so an unconfigured deploy
# must stop the release, never pass silently.
#
# When the target is chosen, replace the body with the real deploy (domains
# differ per environment: dev.<domain> vs <domain>) and keep `exit 1` on any
# failure.
set -euo pipefail
env="${1:?usage: deploy.sh dev|prod}"
echo "deploy.sh: hosting target for '$env' is not configured yet" >&2
exit 1
