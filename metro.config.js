const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase compatibility fix for production builds
// This ensures Metro resolves the correct .cjs files for Firebase SDKs
config.resolver.sourceExts.push('cjs');

module.exports = config;
