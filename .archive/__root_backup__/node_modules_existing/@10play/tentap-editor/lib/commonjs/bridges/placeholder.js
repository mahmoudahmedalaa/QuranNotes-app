"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PlaceholderEditorActionType = exports.PlaceholderBridge = void 0;
var _extensions = require("@tiptap/extensions");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let PlaceholderEditorActionType = exports.PlaceholderEditorActionType = /*#__PURE__*/function (PlaceholderEditorActionType) {
  PlaceholderEditorActionType["setPlaceholder"] = "set-placeholder";
  return PlaceholderEditorActionType;
}({});
const PlaceholderBridge = exports.PlaceholderBridge = new _base.default({
  tiptapExtension: _extensions.Placeholder,
  extendCSS: `
    .is-editor-empty:first-child::before {
        color: #adb5bd;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }
  `,
  onBridgeMessage: (editor, message) => {
    switch (message.type) {
      case PlaceholderEditorActionType.setPlaceholder:
        const currentExtensions = editor.extensionManager.extensions;
        currentExtensions.forEach(extension => {
          if (extension.name === 'placeholder') {
            extension.options.placeholder = message.payload;
          }
        });

        // TODO: find better way to update the editor
        editor.setOptions();
        break;
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    const setPlaceholder = newPlaceholder => sendBridgeMessage({
      type: PlaceholderEditorActionType.setPlaceholder,
      payload: newPlaceholder
    });
    return {
      setPlaceholder
    };
  }
});
//# sourceMappingURL=placeholder.js.map