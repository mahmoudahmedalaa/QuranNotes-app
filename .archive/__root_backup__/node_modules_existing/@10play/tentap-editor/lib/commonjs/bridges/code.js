"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CodeEditorActionType = exports.CodeBridge = void 0;
var _extensionCode = _interopRequireDefault(require("@tiptap/extension-code"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let CodeEditorActionType = exports.CodeEditorActionType = /*#__PURE__*/function (CodeEditorActionType) {
  CodeEditorActionType["ToggleCode"] = "toggle-code";
  return CodeEditorActionType;
}({});
const CodeBridge = exports.CodeBridge = new _base.default({
  tiptapExtension: _extensionCode.default,
  //   tiptapExtensionDeps: [CodeBlock],
  onBridgeMessage: (editor, message) => {
    if (message.type === CodeEditorActionType.ToggleCode) {
      editor.chain().focus().toggleCode().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleCode: () => sendBridgeMessage({
        type: CodeEditorActionType.ToggleCode
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleCode: editor.can().toggleCode(),
      isCodeActive: editor.isActive('code')
    };
  },
  extendCSS: `
    code {
        background-color: #6161611a;
        border-radius: 0.25em;
        box-decoration-break: clone;
        color: #616161;
        font-size: 0.9rem;
        padding: 0.25em;
    }
  `
});
//# sourceMappingURL=code.js.map