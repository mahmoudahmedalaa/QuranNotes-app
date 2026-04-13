"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mergeThemes = void 0;
var _merge = _interopRequireDefault(require("lodash/merge"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const mergeThemes = (theme1, theme2) => (0, _merge.default)(theme1, theme2);
exports.mergeThemes = mergeThemes;
//# sourceMappingURL=mergeThemes.js.map