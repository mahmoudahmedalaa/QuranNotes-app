"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ItalicEditorActionType = exports.ItalicBridge = void 0;
var _extensionItalic = _interopRequireDefault(require("@tiptap/extension-italic"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let ItalicEditorActionType = exports.ItalicEditorActionType = /*#__PURE__*/function (ItalicEditorActionType) {
  ItalicEditorActionType["ToggleItalic"] = "toggle-italic";
  return ItalicEditorActionType;
}({});
const ItalicBridge = exports.ItalicBridge = new _base.default({
  tiptapExtension: _extensionItalic.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === ItalicEditorActionType.ToggleItalic) {
      editor.chain().focus().toggleItalic().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleItalic: () => sendBridgeMessage({
        type: ItalicEditorActionType.ToggleItalic
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleItalic: editor.can().toggleItalic(),
      isItalicActive: editor.isActive('italic')
    };
  }
});
//# sourceMappingURL=italic.js.map