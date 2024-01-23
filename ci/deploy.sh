#!/bin/bash

set -e
SHA=$(git rev-parse --short --verify HEAD)
git checkout gh-pages
git checkout master -- build/
git checkout master -- package.json
git checkout master -- webpack.config.js
git checkout master -- src/
yarn && yarn build
cp -R build/* .
git add .
git commit -m "Built website from {$SHA}."
git push -f origin gh-pages
git checkout master


