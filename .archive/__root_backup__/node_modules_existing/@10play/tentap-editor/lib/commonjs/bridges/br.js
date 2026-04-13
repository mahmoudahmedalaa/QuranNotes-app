"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HardBreakEditorActionType = exports.HardBreakBridge = void 0;
var _extensionHardBreak = _interopRequireDefault(require("@tiptap/extension-hard-break"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let HardBreakEditorActionType = exports.HardBreakEditorActionType = /*#__PURE__*/function (HardBreakEditorActionType) {
  HardBreakEditorActionType["setHardBreak"] = "set-hard-break";
  return HardBreakEditorActionType;
}({});
const HardBreakBridge = exports.HardBreakBridge = new _base.default({
  tiptapExtension: _extensionHardBreak.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === HardBreakEditorActionType.setHardBreak) {
      console.log('setting hard break');
      editor.chain().focus().setHardBreak().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setHardBreak: () => sendBridgeMessage({
        type: HardBreakEditorActionType.setHardBreak
      })
    };
  },
  extendEditorState: () => {
    return {};
  }
});
//# sourceMappingURL=br.js.map