"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.UnderlineEditorActionType = exports.UnderlineBridge = void 0;
var _extensionUnderline = _interopRequireDefault(require("@tiptap/extension-underline"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let UnderlineEditorActionType = exports.UnderlineEditorActionType = /*#__PURE__*/function (UnderlineEditorActionType) {
  UnderlineEditorActionType["ToggleUnderline"] = "toggle-underline";
  return UnderlineEditorActionType;
}({});
const UnderlineBridge = exports.UnderlineBridge = new _base.default({
  tiptapExtension: _extensionUnderline.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === UnderlineEditorActionType.ToggleUnderline) {
      editor.chain().focus().toggleUnderline().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleUnderline: () => sendBridgeMessage({
        type: UnderlineEditorActionType.ToggleUnderline
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleUnderline: editor.can().toggleUnderline(),
      isUnderlineActive: editor.isActive('underline')
    };
  }
});
//# sourceMappingURL=underline.js.map