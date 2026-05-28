#!/usr/bin/env bash
# render-build.sh

set -o errexit

echo "=== Установка зависимостей ==="
npm install

echo "=== Установка Chromium для Puppeteer ==="
npx puppeteer browsers install chrome

echo "=== Сборка завершена ==="