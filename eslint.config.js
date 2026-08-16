// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "**/.archive/**",
      "**/node_modules/**",
      "**/ios/**",
      "**/functions/**",
      "**/dist/**",
      "**/*backup*/**",
      "**/*generated*/**",
    ],
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        exports: "readonly",
        fetch: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
  },
]);
