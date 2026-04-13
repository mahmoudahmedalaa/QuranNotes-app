import Heading from '@tiptap/extension-heading';
import BridgeExtension from './base';
export let HeadingEditorActionType = /*#__PURE__*/function (HeadingEditorActionType) {
  HeadingEditorActionType["ToggleHeading"] = "toggle-heading";
  return HeadingEditorActionType;
}({});
export const HeadingBridge = new BridgeExtension({
  tiptapExtension: Heading,
  onBridgeMessage: (editor, message) => {
    if (message.type === HeadingEditorActionType.ToggleHeading) {
      editor.chain().focus().toggleHeading({
        level: message.payload
      }).run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleHeading: level => sendBridgeMessage({
        type: HeadingEditorActionType.ToggleHeading,
        payload: level
      })
    };
  },
  extendEditorState: editor => {
    var _editor$getAttributes;
    return {
      canToggleHeading: editor.can().toggleHeading({
        level: 1
      }),
      headingLevel: (_editor$getAttributes = editor.getAttributes('heading')) === null || _editor$getAttributes === void 0 ? void 0 : _editor$getAttributes.level
    };
  }
});
//# sourceMappingURL=heading.js.map