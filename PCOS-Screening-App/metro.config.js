// Metro config.
//
// NativeWind was previously wired in here, but the setup was incomplete —
// babel.config.js never set the `jsxImportSource` NativeWind v4 requires, and
// `global.css` was never imported — so it could not have worked. No component
// used `className`; all styling goes through StyleSheet plus the tokens in
// theme/. The plugin has been removed rather than finished.

const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
