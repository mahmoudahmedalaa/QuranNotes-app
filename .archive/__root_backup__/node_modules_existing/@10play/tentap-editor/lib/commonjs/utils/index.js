"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _useKeyboard = require("./useKeyboard");
Object.keys(_useKeyboard).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _useKeyboard[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _useKeyboard[key];
    }
  });
});
var _uniqueBy = require("./uniqueBy");
Object.keys(_uniqueBy).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (key in exports && exports[key] === _uniqueBy[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _uniqueBy[key];
    }
  });
});
//# sourceMappingURL=index.js.map