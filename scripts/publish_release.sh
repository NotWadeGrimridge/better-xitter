#!/usr/bin/env bash
set -euo pipefail

VERSION="$(jq -r '.version' src/manifest.json)"
TAG="v${VERSION}"
CHROME_ZIP="dist/better-xitter-chrome.zip"
FIREFOX_XPI="dist/better-xitter-firefox.xpi"

rm -rf dist

deno run -A scripts/build.ts

git tag -f "${TAG}"
git push -f origin "${TAG}"

gh auth switch -u NotWadeGrimridge
if gh release view "${TAG}" >/dev/null 2>&1; then
  gh release upload "${TAG}" "${CHROME_ZIP}" "${FIREFOX_XPI}" --clobber
else
  gh release create "${TAG}" "${CHROME_ZIP}" "${FIREFOX_XPI}" \
    --title "${TAG}" \
    --notes ""
fi
