import { BulletList, ListItem } from '@tiptap/extension-list';
import BridgeExtension from './base';
export let BulletListEditorActionType = /*#__PURE__*/function (BulletListEditorActionType) {
  BulletListEditorActionType["ToggleBulletList"] = "toggle-bulletList";
  return BulletListEditorActionType;
}({});
export const BulletListBridge = new BridgeExtension({
  tiptapExtension: BulletList,
  tiptapExtensionDeps: [ListItem],
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