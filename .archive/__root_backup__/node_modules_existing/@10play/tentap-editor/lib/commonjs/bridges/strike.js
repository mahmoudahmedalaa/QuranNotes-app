"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StrikeEditorActionType = exports.StrikeBridge = void 0;
var _extensionStrike = _interopRequireDefault(require("@tiptap/extension-strike"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let StrikeEditorActionType = exports.StrikeEditorActionType = /*#__PURE__*/function (StrikeEditorActionType) {
  StrikeEditorActionType["ToggleStrike"] = "toggle-strike";
  return StrikeEditorActionType;
}({});
const StrikeBridge = exports.StrikeBridge = new _base.default({
  tiptapExtension: _extensionStrike.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === StrikeEditorActionType.ToggleStrike) {
      editor.chain().focus().toggleStrike().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleStrike: () => sendBridgeMessage({
        type: StrikeEditorActionType.ToggleStrike
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleStrike: editor.can().toggleStrike(),
      isStrikeActive: editor.isActive('strike')
    };
  }
});
//# sourceMappingURL=strike.js.map