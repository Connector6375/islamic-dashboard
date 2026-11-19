#!/bin/sh
# One-way mirror of a PUBLIC GitHub branch into a local folder (Mac / Linux).
# Needs only curl + tar. Files are copied over; files deleted on GitHub are NOT deleted locally.
#
#   sh sync-from-github.sh "<target folder>" [owner/repo] [branch]
#
# Example (every 15 minutes, via cron):  crontab -e
#   */15 * * * * sh "$HOME/sync-from-github.sh" "$HOME/Google Drive/Claude/01 School/Classroom & Activities/islamic-dashboard"
#
# For Windows use sync-from-github.ps1.
set -eu

TARGET=${1:?usage: sync-from-github.sh TARGET [owner/repo] [branch]}
REPO=${2:-Connector6375/islamic-dashboard}
BRANCH=${3:-ccr-f7a4ee6e-6ltht5}
API=${GITHUB_API:-https://api.github.com}          # overridable for tests
CODELOAD=${GITHUB_CODELOAD:-https://codeload.github.com}

STATE=${XDG_STATE_HOME:-$HOME/.local/state}/github-mirror/$(printf '%s' "$REPO" | tr '/' '-')
mkdir -p "$STATE" "$TARGET"
LOG=$STATE/sync.log
log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

SHA=$(curl -fsSL -H 'Accept: application/vnd.github.sha' -H 'User-Agent: github-mirror' "$API/repos/$REPO/commits/$BRANCH") \
  || { log "ERROR: could not read $REPO@$BRANCH (offline, wrong name, or GitHub rate limit)"; exit 1; }

if [ -f "$STATE/last-sync" ] && [ "$(cat "$STATE/last-sync")" = "$SHA" ]; then
  log "up to date ($SHA)"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$CODELOAD/$REPO/tar.gz/$SHA" -o "$TMP/snapshot.tar.gz" \
  || { log "ERROR: download of $SHA failed"; exit 1; }
tar -xzf "$TMP/snapshot.tar.gz" -C "$TMP"
SRC=$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n 1)
# copy everything, hidden folders (.claude) included
(cd "$SRC" && tar -cf - .) | (cd "$TARGET" && tar -xf -)
printf '%s\n' "$SHA" > "$STATE/last-sync"
log "synced $REPO@$BRANCH $SHA -> $TARGET"
