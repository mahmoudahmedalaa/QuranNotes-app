"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BulletListEditorActionType = exports.BulletListBridge = void 0;
var _extensionList = require("@tiptap/extension-list");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let BulletListEditorActionType = exports.BulletListEditorActionType = /*#__PURE__*/function (BulletListEditorActionType) {
  BulletListEditorActionType["ToggleBulletList"] = "toggle-bulletList";
  return BulletListEditorActionType;
}({});
const BulletListBridge = exports.BulletListBridge = new _base.default({
  tiptapExtension: _extensionList.BulletList,
  tiptapExtensionDeps: [_extensionList.ListItem],
  onBridgeMessage: (editor, message) => {
    if (message.type === BulletListEditorActionType.ToggleBulletList) {
      editor.chain().focus().toggleBulletList().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleBulletList: () => sendBridgeMessage({
        type: BulletListEditorActionType.ToggleBulletList
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleBulletList: editor.can().toggleBulletList(),
      isBulletListActive: editor.isActive('bulletList')
    };
  }
});
//# sourceMappingURL=bulletList.js.map