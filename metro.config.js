const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// expo-sqlite's web driver loads this binary as an asset rather than JavaScript.
config.resolver.assetExts.push('wasm');
module.exports = config;
