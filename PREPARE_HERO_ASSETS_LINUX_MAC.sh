#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm run assets:heroes
npm run assets:heroes:verify
printf '\nHero assets are ready. You can now run npm start.\n'
