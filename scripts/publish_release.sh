#!/usr/bin/env bash
set -euo pipefail

VERSION="$(jq -r '.version' src/manifest.json)"
TAG="v${VERSION}"
ZIP_PATH="dist/better-xitter-chrome.zip"

rm -rf dist

deno run -A scripts/build.ts

git tag -f "${TAG}"
git push -f origin "${TAG}"

if gh release view "${TAG}" >/dev/null 2>&1; then
  gh release upload "${TAG}" "${ZIP_PATH}" --clobber
else
  gh release create "${TAG}" "${ZIP_PATH}" \
    --title "${TAG}" \
    --notes ""
fi
