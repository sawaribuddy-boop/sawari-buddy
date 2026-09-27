// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('@expo/metro-config');
const { resolve } = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so workspace packages resolve).
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages from — apps/mobile first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  resolve(projectRoot, 'node_modules'),
  resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
