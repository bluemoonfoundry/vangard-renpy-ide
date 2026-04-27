#!/bin/bash
# Helper script to update GitHub issue #144 with Phase 2 progress
# Usage: ./update-phase2-progress.sh <stage_number> <status> [commit_hash]
#   status: "started" | "completed"
#   commit_hash: optional, git commit SHA

STAGE=$1
STATUS=$2
COMMIT_HASH=${3:-$(git rev-parse --short HEAD)}

if [ -z "$STAGE" ] || [ -z "$STATUS" ]; then
  echo "Usage: $0 <stage_number> <status> [commit_hash]"
  echo "  status: started | completed"
  exit 1
fi

GH_BIN=~/Development/gh_2.89.0_macOS_arm64/bin/gh

case $STATUS in
  started)
    MESSAGE="🔄 **Stage $STAGE: Started**

Beginning extraction of stage $STAGE hook.

Commit: \`$COMMIT_HASH\`"
    ;;
  completed)
    MESSAGE="✅ **Stage $STAGE: Completed**

Successfully extracted stage $STAGE hook. All tests passing.

Commit: \`$COMMIT_HASH\`"
    ;;
  *)
    echo "Error: status must be 'started' or 'completed'"
    exit 1
    ;;
esac

$GH_BIN issue comment 144 --body "$MESSAGE"
echo "Updated issue #144: Stage $STAGE - $STATUS"
