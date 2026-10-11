#!/usr/bin/env bash
# Post an agent message to a project's Discord channel (standards 04).
#
#   notify.sh updates  "Implemented the discount grouping. Tests 24/24."
#   notify.sh alerts   --need decision|review|blocked [--mention <discord-user-id>] "what you need, why, options, reply"
#   notify.sh playground "Preview: <link>"
#   add --dry-run to see the payload without sending.
#
# updates    -> ai-updates, prefixed "✅ DONE". Nobody is mentioned.
# alerts     -> ai-alerts, prefixed "❓ NEED DECISION" | "🔎 REVIEW" | "⚠️ BLOCKED". Mentions the one
#               person given by --mention or $DISCORD_OWNER_ID. Never @everyone or @here.
# playground -> playground, no prefix.
#
# The webhook URL is a secret and is never printed. Two ways to post:
#   1. Direct: the URL is in the environment or in ./.env (a local machine). Prints "sent to <channel>".
#   2. Via GitHub Action: no URL here (a Claude Remote session), but the repo has
#      .github/workflows/discord-notify.yml, whose runner holds the secrets. The script starts that
#      workflow with `gh workflow run`. Prints "queued via GitHub Action": accepted, not yet delivered.
# Exit 0 = sent or queued. Exit 2 = bad usage. Exit 3 = NOT SENT (no URL and no way to dispatch,
# the message could not be built, or Discord refused). Text over 2000 characters is cut and ends in "…". On exit 3, tell the human the message was not sent; never claim a ping happened.
set -u

die_usage() { echo "notify.sh: $*" >&2; echo "usage: notify.sh updates|alerts|playground [--need decision|review|blocked] [--mention ID] [--dry-run] \"message\"" >&2; exit 2; }

[ $# -ge 1 ] || die_usage "missing channel"
channel=$1; shift
need=""; mention="${DISCORD_OWNER_ID:-}"; dry=0; text=""
while [ $# -gt 0 ]; do
  case $1 in
    --need) [ $# -ge 2 ] || die_usage "--need needs a value"; need=$2; shift 2 ;;
    --mention) [ $# -ge 2 ] || die_usage "--mention needs a value"; mention=$2; shift 2 ;;
    --dry-run) dry=1; shift ;;
    --) shift; text="$*"; break ;;
    -*) die_usage "unknown option $1" ;;
    *) text="${text:+$text }$1"; shift ;;
  esac
done
[ -n "$text" ] || die_usage "missing message"

case $channel in
  updates)    var=DISCORD_WEBHOOK_AI_UPDATES; prefix="✅ DONE"; mention="" ;;
  alerts)     var=DISCORD_WEBHOOK_AI_ALERTS
              case $need in
                decision) prefix="❓ NEED DECISION" ;;
                review)   prefix="🔎 REVIEW" ;;
                blocked)  prefix="⚠️ BLOCKED" ;;
                *) die_usage "alerts need --need decision|review|blocked" ;;
              esac ;;
  playground) var=DISCORD_WEBHOOK_PLAYGROUND; prefix=""; mention="" ;;
  *) die_usage "channel must be updates, alerts or playground" ;;
esac
case $mention in ""|*[!0-9]*) [ -z "$mention" ] || die_usage "--mention must be a numeric Discord user id" ;; esac

# Build the JSON body. Mentions are limited to the one user (allowed_mentions), so a stray @everyone
# in the text cannot ping anyone.
payload=$(PREFIX="$prefix" TEXT="$text" MENTION="$mention" python3 -c '
import json, os
head = " ".join(p for p in (os.environ["PREFIX"], "<@%s>" % os.environ["MENTION"] if os.environ["MENTION"] else "") if p)
content = (head + "\n" if head else "") + os.environ["TEXT"]
allowed = {"parse": [], "users": [os.environ["MENTION"]] if os.environ["MENTION"] else []}
if len(content) > 2000:
    content = content[:1999] + "\u2026"
print(json.dumps({"content": content, "allowed_mentions": allowed}, ensure_ascii=False))
') || { echo "NOT SENT: could not build the message (python3 needed, or the text is not valid UTF-8). Tell the human; do not claim a Discord post happened." >&2; exit 3; }

if [ "$dry" = 1 ]; then
  echo "channel: $channel ($var)"; echo "$payload"; exit 0
fi

url=${!var:-}
if [ -z "$url" ] && [ -f .env ]; then
  url=$(sed -n "s/^${var}=//p" .env | head -1 | tr -d "\"'\r")
fi
if [ -z "$url" ]; then
  # No URL on this machine. Outside GitHub Actions, ask the repo's discord-notify workflow to post.
  if [ -z "${GITHUB_ACTIONS:-}" ] && [ -f .github/workflows/discord-notify.yml ] && command -v gh >/dev/null 2>&1; then
    args=(-f "channel=$channel" -f "message=$text")
    [ -n "$need" ] && args+=(-f "need=$need")
    [ -n "$mention" ] && args+=(-f "mention=$mention")
    if gh workflow run discord-notify.yml "${args[@]}" >/dev/null 2>&1; then
      echo "queued via GitHub Action (discord-notify) for $channel"; exit 0
    fi
    echo "NOT SENT: no $var here and 'gh workflow run discord-notify.yml' failed (not logged in, no Actions permission, or the workflow is not on the default branch). Tell the human; do not claim a Discord post happened." >&2
    exit 3
  fi
  echo "NOT SENT: $var is not set (environment or .env) and no discord-notify workflow can be started from here (not a dispatchable checkout, no gh, or already inside Actions). Tell the human; do not claim a Discord post happened." >&2
  exit 3
fi

# The URL goes to curl through a config file on stdin so it never appears in the process list.
code=$(printf 'url = "%s"\n' "$url" | curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
  -H 'Content-Type: application/json' --data-binary "$payload" --config - 2>/dev/null)
case $code in
  2??) echo "sent to $channel"; exit 0 ;;
  *)   echo "NOT SENT: Discord answered HTTP ${code:-none} for $channel. Tell the human; do not claim a Discord post happened." >&2; exit 3 ;;
esac
