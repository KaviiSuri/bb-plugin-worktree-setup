#!/usr/bin/env bash
# Cut a release for this bb plugin: bump the version, rebuild dist/, commit both,
# and create an annotated v<version> tag. Push is opt-in (--push) so nothing
# leaves your machine unless you ask.
#
# Usage:
#   scripts/release.sh patch            # 0.1.0 -> 0.1.1
#   scripts/release.sh minor            # 0.1.0 -> 0.2.0
#   scripts/release.sh major            # 0.1.0 -> 1.0.0
#   scripts/release.sh 1.4.2            # explicit version
#   scripts/release.sh patch --push     # also push commit + tag to origin
set -euo pipefail

cd "$(dirname "$0")/.."

BUMP="${1:-}"
PUSH=0
for arg in "${@:2}"; do
  case "$arg" in
    --push) PUSH=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$BUMP" ]]; then
  echo "usage: scripts/release.sh <patch|minor|major|X.Y.Z> [--push]" >&2
  exit 2
fi

# --- preflight -------------------------------------------------------------
branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$branch" != "main" ]]; then
  echo "error: releases must be cut from main (on '$branch')" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty; commit or stash before releasing" >&2
  git status --short >&2
  exit 1
fi

# --- bump ------------------------------------------------------------------
# npm version updates package.json (+ lockfile) without creating its own tag.
new_version=$(npm version "$BUMP" --no-git-tag-version)
new_version="${new_version#v}"
tag="v${new_version}"

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "error: tag ${tag} already exists" >&2
  git checkout -- package.json package-lock.json 2>/dev/null || true
  exit 1
fi

echo "==> releasing ${tag}"

# --- build -----------------------------------------------------------------
echo "==> building dist/"
bb plugin build .

# --- commit + tag ----------------------------------------------------------
git add package.json package-lock.json dist/
git commit -m "release: ${tag}"
git tag -a "${tag}" -m "${tag}"

echo "==> committed and tagged ${tag}"

if [[ "$PUSH" -eq 1 ]]; then
  echo "==> pushing to origin"
  git push origin "$branch"
  git push origin "${tag}"
  echo "==> pushed ${branch} and ${tag}"
else
  echo
  echo "Not pushed. To publish:"
  echo "  git push origin ${branch} && git push origin ${tag}"
fi
