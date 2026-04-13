import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import BridgeExtension from './base';
export let HighlightEditorActionType = /*#__PURE__*/function (HighlightEditorActionType) {
  HighlightEditorActionType["SetHighlight"] = "set-highlight";
  HighlightEditorActionType["ToggleHighlight"] = "toggle-highlight";
  HighlightEditorActionType["UnsetHighlight"] = "unset-highlight";
  return HighlightEditorActionType;
}({});
export const HighlightBridge = new BridgeExtension({
  tiptapExtension: Highlight.configure({
    multicolor: true
  }),
  tiptapExtensionDeps: [TextStyle],
  onBridgeMessage: (editor, {
    type,
    payload
  }) => {
    switch (type) {
      case HighlightEditorActionType.SetHighlight:
        editor.chain().focus().setHighlight({
          color: payload
        }).run();
        break;
      case HighlightEditorActionType.ToggleHighlight:
        editor.chain().focus().toggleHighlight({
          color: payload
        }).run();
        break;
      case HighlightEditorActionType.UnsetHighlight:
        editor.chain().focus().unsetHighlight().run();
        break;
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      setHighlight: color => sendBridgeMessage({
        type: HighlightEditorActionType.SetHighlight,
        payload: color
      }),
      toggleHighlight: color => sendBridgeMessage({
        type: HighlightEditorActionType.ToggleHighlight,
        payload: color
      }),
      unsetHighlight: () => sendBridgeMessage({
        type: HighlightEditorActionType.UnsetHighlight,
        payload: undefined
      })
    };
  },
  extendEditorState: editor => {
    return {
      activeHighlight: editor.getAttributes('highlight').color
    };
  }
});
//# sourceMappingURL=highlight.js.map