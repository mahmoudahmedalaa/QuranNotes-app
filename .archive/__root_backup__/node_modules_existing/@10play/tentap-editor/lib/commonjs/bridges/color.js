"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ColorEditorActionType = exports.ColorBridge = void 0;
var _extensionTextStyle = require("@tiptap/extension-text-style");
var _extensionColor = require("@tiptap/extension-color");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let ColorEditorActionType = exports.ColorEditorActionType = /*#__PURE__*/function (ColorEditorActionType) {
  ColorEditorActionType["SetColor"] = "set-color";
  ColorEditorActionType["UnsetColor"] = "unset-color";
  return ColorEditorActionType;
}({});
const ColorBridge = exports.ColorBridge = new _base.default({
  tiptapExtension: _extensionColor.Color,
  tiptapExtensionDeps: [_extensionTextStyle.TextStyle],
  onBridgeMessage: (editor, {
    type,
    payload
  }) => {
    switch (type) {
      case ColorEditorActionType.SetColor:
        editor.chain().focus().setColor(payload).run();
        break;
      case ColorEditorActionType.UnsetColor:
        editor.chain().focus().unsetColor().run();
        break;
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setColor: color => sendBridgeMessage({
        type: ColorEditorActionType.SetColor,
        payload: color
      }),
      unsetColor: () => sendBridgeMessage({
        type: ColorEditorActionType.UnsetColor,
        payload: undefined
      })
    };
  },
  extendEditorState: editor => {
    return {
      activeColor: editor.getAttributes('textStyle').color
    };
  }
});
//# sourceMappingURL=color.js.map