#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

echo '[1/3] Downloading official Japanese, Simplified Chinese, Korean, and Spanish hero text...'
npm run i18n:heroes:sync

echo '[2/3] Verifying complete current-roster coverage for every official locale...'
npm run i18n:heroes:verify:full

echo '[3/3] Running i18n regression tests...'
npm run test:i18n

echo 'Official hero translations are ready.'
