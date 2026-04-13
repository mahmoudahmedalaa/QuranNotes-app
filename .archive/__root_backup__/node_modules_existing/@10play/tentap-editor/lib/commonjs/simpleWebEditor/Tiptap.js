"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Tiptap;
var _react = _interopRequireDefault(require("react"));
var _react2 = require("@tiptap/react");
var _webEditorUtils = require("../webEditorUtils");
var _StarterKit = require("../bridges/StarterKit");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let tenTapExtensions = _StarterKit.TenTapStartKit.filter(e => !window.whiteListBridgeExtensions || window.whiteListBridgeExtensions.includes(e.name));
function Tiptap() {
  const editor = (0, _webEditorUtils.useTenTap)({
    bridges: tenTapExtensions
  });
  return /*#__PURE__*/_react.default.createElement(_react2.EditorContent, {
    editor: editor,
    className: window.dynamicHeight ? 'dynamic-height' : undefined
  });
}
//# sourceMappingURL=Tiptap.js.map