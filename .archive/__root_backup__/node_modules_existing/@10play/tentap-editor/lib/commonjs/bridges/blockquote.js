"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BlockquoteEditorActionType = exports.BlockquoteBridge = void 0;
var _extensionBlockquote = _interopRequireDefault(require("@tiptap/extension-blockquote"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let BlockquoteEditorActionType = exports.BlockquoteEditorActionType = /*#__PURE__*/function (BlockquoteEditorActionType) {
  BlockquoteEditorActionType["ToggleBlockquote"] = "toggle-blockquote";
  return BlockquoteEditorActionType;
}({});
const BlockquoteBridge = exports.BlockquoteBridge = new _base.default({
  tiptapExtension: _extensionBlockquote.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === BlockquoteEditorActionType.ToggleBlockquote) {
      editor.chain().focus().toggleBlockquote().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleBlockquote: () => sendBridgeMessage({
        type: BlockquoteEditorActionType.ToggleBlockquote
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleBlockquote: editor.can().toggleBlockquote(),
      isBlockquoteActive: editor.isActive('blockquote')
    };
  },
  extendCSS: `
    blockquote {
        border-left: 3px solid #0d0d0d1a;
        padding-left: 1rem;
    }
  `
});
//# sourceMappingURL=blockquote.js.map