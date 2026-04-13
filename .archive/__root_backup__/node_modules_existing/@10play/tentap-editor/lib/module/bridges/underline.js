import Underline from '@tiptap/extension-underline';
import BridgeExtension from './base';
export let UnderlineEditorActionType = /*#__PURE__*/function (UnderlineEditorActionType) {
  UnderlineEditorActionType["ToggleUnderline"] = "toggle-underline";
  return UnderlineEditorActionType;
}({});
export const UnderlineBridge = new BridgeExtension({
  tiptapExtension: Underline,
  onBridgeMessage: (editor, message) => {
    if (message.type === UnderlineEditorActionType.ToggleUnderline) {
      editor.chain().focus().toggleUnderline().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleUnderline: () => sendBridgeMessage({
        type: UnderlineEditorActionType.ToggleUnderline
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleUnderline: editor.can().toggleUnderline(),
      isUnderlineActive: editor.isActive('underline')
    };
  }
});
//# sourceMappingURL=underline.js.map