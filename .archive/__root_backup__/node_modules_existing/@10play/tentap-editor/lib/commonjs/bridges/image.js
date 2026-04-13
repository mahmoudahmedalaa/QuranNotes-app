"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ImageEditorActionType = exports.ImageBridge = void 0;
var _extensionImage = _interopRequireDefault(require("@tiptap/extension-image"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let ImageEditorActionType = exports.ImageEditorActionType = /*#__PURE__*/function (ImageEditorActionType) {
  ImageEditorActionType["SetImage"] = "set-image";
  return ImageEditorActionType;
}({});
const ImageBridge = exports.ImageBridge = new _base.default({
  tiptapExtension: _extensionImage.default.configure({
    allowBase64: true
  }),
  onBridgeMessage: (editor, message) => {
    if (message.type === ImageEditorActionType.SetImage) {
      editor.chain().focus().setImage({
        src: message.payload
      }).setTextSelection(editor.state.selection.to + 1).run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setImage: src => sendBridgeMessage({
        type: ImageEditorActionType.SetImage,
        payload: src
      })
    };
  },
  extendEditorState: () => {
    return {};
  },
  extendCSS: `
  img {
    height: auto;
    max-width: 100%;
  }

  img &.ProseMirror-selectednode {
    outline: 3px solid #68cef8;
  }
  `
});
//# sourceMappingURL=image.js.map