"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _vite = require("vite");
var _path = require("path");
// This config is used to build the web editor into a single file
var _default = exports.default = (0, _vite.defineConfig)({
  build: {
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: (0, _path.resolve)(__dirname, './index.ts'),
      name: 'tentapWebutils',
      // the proper extensions will be added
      fileName: 'index'
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ['react', 'react/jsx-runtime', 'react-dom'],
      output: {
        dir: 'lib-web',
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          react: 'React'
        }
      }
    }
  }
});
//# sourceMappingURL=vite.config.js.map