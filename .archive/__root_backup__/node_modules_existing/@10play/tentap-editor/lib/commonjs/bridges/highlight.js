"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HighlightEditorActionType = exports.HighlightBridge = void 0;
var _extensionTextStyle = require("@tiptap/extension-text-style");
var _extensionHighlight = require("@tiptap/extension-highlight");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let HighlightEditorActionType = exports.HighlightEditorActionType = /*#__PURE__*/function (HighlightEditorActionType) {
  HighlightEditorActionType["SetHighlight"] = "set-highlight";
  HighlightEditorActionType["ToggleHighlight"] = "toggle-highlight";
  HighlightEditorActionType["UnsetHighlight"] = "unset-highlight";
  return HighlightEditorActionType;
}({});
const HighlightBridge = exports.HighlightBridge = new _base.default({
  tiptapExtension: _extensionHighlight.Highlight.configure({
    multicolor: true
  }),
  tiptapExtensionDeps: [_extensionTextStyle.TextStyle],
  onBridgeMessage: (editor, {
    type,
    payload
  }) => {
    switch (type) {
      case HighlightEditorActionType.SetHighlight:
        editor.chain().focus().setHighlight({
          color: payload
        }).run();
        break;
      case HighlightEditorActionType.ToggleHighlight:
        editor.chain().focus().toggleHighlight({
          color: payload
        }).run();
        break;
      case HighlightEditorActionType.UnsetHighlight:
        editor.chain().focus().unsetHighlight().run();
        break;
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setHighlight: color => sendBridgeMessage({
        type: HighlightEditorActionType.SetHighlight,
        payload: color
      }),
      toggleHighlight: color => sendBridgeMessage({
        type: HighlightEditorActionType.ToggleHighlight,
        payload: color
      }),
      unsetHighlight: () => sendBridgeMessage({
        type: HighlightEditorActionType.UnsetHighlight,
        payload: undefined
      })
    };
  },
  extendEditorState: editor => {
    return {
      activeHighlight: editor.getAttributes('highlight').color
    };
  }
});
//# sourceMappingURL=highlight.js.map