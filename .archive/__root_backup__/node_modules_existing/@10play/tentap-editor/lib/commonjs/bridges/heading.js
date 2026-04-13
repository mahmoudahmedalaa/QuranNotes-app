"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HeadingEditorActionType = exports.HeadingBridge = void 0;
var _extensionHeading = _interopRequireDefault(require("@tiptap/extension-heading"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let HeadingEditorActionType = exports.HeadingEditorActionType = /*#__PURE__*/function (HeadingEditorActionType) {
  HeadingEditorActionType["ToggleHeading"] = "toggle-heading";
  return HeadingEditorActionType;
}({});
const HeadingBridge = exports.HeadingBridge = new _base.default({
  tiptapExtension: _extensionHeading.default,
  onBridgeMessage: (editor, message) => {
    if (message.type === HeadingEditorActionType.ToggleHeading) {
      editor.chain().focus().toggleHeading({
        level: message.payload
      }).run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleHeading: level => sendBridgeMessage({
        type: HeadingEditorActionType.ToggleHeading,
        payload: level
      })
    };
  },
  extendEditorState: editor => {
    var _editor$getAttributes;
    return {
      canToggleHeading: editor.can().toggleHeading({
        level: 1
      }),
      headingLevel: (_editor$getAttributes = editor.getAttributes('heading')) === null || _editor$getAttributes === void 0 ? void 0 : _editor$getAttributes.level
    };
  }
});
//# sourceMappingURL=heading.js.map