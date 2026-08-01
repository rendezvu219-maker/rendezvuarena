#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then
  echo "Usage: ./PUBLISH_TO_GITHUB_LINUX_MAC.sh https://github.com/USERNAME/rendezvu-arena.git" >&2
  exit 1
fi
command -v git >/dev/null 2>&1 || { echo "Git is not installed." >&2; exit 1; }
[ -d .git ] || git init
git branch -M main
git add .
git commit -m "Initial RendezVu Arena release" || true
git remote remove origin 2>/dev/null || true
git remote add origin "$1"
git push -u origin main
