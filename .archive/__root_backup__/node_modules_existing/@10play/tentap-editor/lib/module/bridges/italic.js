import Italic from '@tiptap/extension-italic';
import BridgeExtension from './base';
export let ItalicEditorActionType = /*#__PURE__*/function (ItalicEditorActionType) {
  ItalicEditorActionType["ToggleItalic"] = "toggle-italic";
  return ItalicEditorActionType;
}({});
export const ItalicBridge = new BridgeExtension({
  tiptapExtension: Italic,
  onBridgeMessage: (editor, message) => {
    if (message.type === ItalicEditorActionType.ToggleItalic) {
      editor.chain().focus().toggleItalic().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleItalic: () => sendBridgeMessage({
        type: ItalicEditorActionType.ToggleItalic
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleItalic: editor.can().toggleItalic(),
      isItalicActive: editor.isActive('italic')
    };
  }
});
//# sourceMappingURL=italic.js.map