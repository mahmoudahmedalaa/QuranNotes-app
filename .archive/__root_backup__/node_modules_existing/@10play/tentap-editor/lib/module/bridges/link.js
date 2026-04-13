import Link from '@tiptap/extension-link';
import BridgeExtension from './base';
export let LinkEditorActionType = /*#__PURE__*/function (LinkEditorActionType) {
  LinkEditorActionType["SetLink"] = "set-link";
  return LinkEditorActionType;
}({});
export const LinkBridge = new BridgeExtension({
  tiptapExtension: Link.configure({
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