#!/usr/bin/env bash
# One-shot publish: create the GitHub repo (public), push main, tag the manifest version, and attach the zip to a Release.
# Usage: scripts/publish.sh            (uses the version in manifest.json)
# Safe to re-run: skips steps that already happened.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }

NAME=tatkal-helper
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
TAG="v$VERSION"
OWNER=$(gh api user -q .login)

if [ ! -d .git ]; then
  git init -q -b main
fi
git add -A
git diff --cached --quiet || git commit -q -m "Tatkal Helper $VERSION"

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$NAME" --public --source=. --remote=origin \
    --description "IRCTC Tatkal helper Chrome extension: saved passengers, one-click form fill, window countdown. Fill-only, you do every click."
fi
git push -u origin main

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  git tag -a "$TAG" -m "$TAG"
fi
git push origin "$TAG"

scripts/build-zip.sh
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "dist/$NAME-$VERSION.zip" --clobber
else
  gh release create "$TAG" "dist/$NAME-$VERSION.zip" --title "Tatkal Helper $VERSION" --notes "Download \`$NAME-$VERSION.zip\`, unzip, open chrome://extensions, turn on Developer mode, click Load unpacked and pick the \`$NAME\` folder. Full steps in the README."
fi

echo
echo "Published: https://github.com/$OWNER/$NAME"
echo "Install link: https://github.com/$OWNER/$NAME/releases/latest"
