#!/bin/bash

set -e
git checkout gh-pages
git checkout master -- build/
git checkout master -- package.json
git checkout master -- webpack.config.js
git checkout master -- src/
yarn && yarn build
cp -R build/* .
git add .
git commit -m "Deploy"
git push origin gh-pages
git checkout master


