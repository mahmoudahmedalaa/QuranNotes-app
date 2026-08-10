#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [[ -z "${QURANNOTES_RELEASE_VERSION:-}" ]]; then
  printf '%s\n' 'Missing required release variable: QURANNOTES_RELEASE_VERSION' >&2
  exit 1
fi

if [[ -z "${QURANNOTES_RELEASE_BUILD:-}" ]]; then
  printf '%s\n' 'Missing required release variable: QURANNOTES_RELEASE_BUILD' >&2
  exit 1
fi

node scripts/validate-release-environment.js --platform ios
node scripts/validate-release-metadata.js

WORKSPACE="ios/QuranNotes.xcworkspace"
if [[ ! -d "$WORKSPACE" ]]; then
  printf '%s\n' 'Missing iOS workspace. Generate it before preparing a release.' >&2
  exit 1
fi

printf 'Validated QuranNotes release %s (%s). Opening Xcode for the human-controlled build.\n' \
  "$QURANNOTES_RELEASE_VERSION" \
  "$QURANNOTES_RELEASE_BUILD"
open "$WORKSPACE"
