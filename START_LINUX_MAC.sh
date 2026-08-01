#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js 22.5+ is required."; exit 1; }
[ -f .env ] || cp .env.example .env
[ -d node_modules ] || npm install
echo "Tournament Operations: http://localhost:3000/dashboard.html"
echo "Player & Captain Portal: http://localhost:3000/portal.html"
echo "Draft UI: http://localhost:3000/"
npm start
