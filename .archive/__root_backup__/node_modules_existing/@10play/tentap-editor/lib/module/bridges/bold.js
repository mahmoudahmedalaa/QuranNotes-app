import Bold from '@tiptap/extension-bold';
import BridgeExtension from './base';
export let BoldEditorActionType = /*#__PURE__*/function (BoldEditorActionType) {
  BoldEditorActionType["ToggleBold"] = "toggle-bold";
  return BoldEditorActionType;
}({});
export const BoldBridge = new BridgeExtension({
  tiptapExtension: Bold,
  onBridgeMessage: (editor, message) => {
    if (message.type === BoldEditorActionType.ToggleBold) {
      editor.chain().focus().toggleBold().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleBold: () => sendBridgeMessage({
        type: BoldEditorActionType.ToggleBold
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleBold: editor.can().toggleBold(),
      isBoldActive: editor.isActive('bold')
    };
  }
});
//# sourceMappingURL=bold.js.map