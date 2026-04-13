"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LinkEditorActionType = exports.LinkBridge = void 0;
var _extensionLink = _interopRequireDefault(require("@tiptap/extension-link"));
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let LinkEditorActionType = exports.LinkEditorActionType = /*#__PURE__*/function (LinkEditorActionType) {
  LinkEditorActionType["SetLink"] = "set-link";
  return LinkEditorActionType;
}({});
const LinkBridge = exports.LinkBridge = new _base.default({
  tiptapExtension: _extensionLink.default.configure({
    openOnClick: false,
    autolink: true
  }),
  onBridgeMessage: (editor, {
    type,
    payload
  }) => {
    if (type === LinkEditorActionType.SetLink) {
      // cancelled
      if (payload === null) {
        return false;
      }

      // empty
      if (payload === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().setTextSelection(editor.state.selection.from).run();
        return false;
      }

      // update link
      editor.chain().focus().extendMarkRange('link').setLink({
        href: payload
      }).setTextSelection(editor.state.selection.from).run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setLink: link => sendBridgeMessage({
        type: LinkEditorActionType.SetLink,
        payload: link
      })
    };
  },
  extendEditorState: editor => {
    return {
      canSetLink: !editor.state.selection.empty,
      isLinkActive: editor.isActive('link'),
      activeLink: editor.getAttributes('link').href
    };
  }
});
//# sourceMappingURL=link.js.map