import Heading from '@tiptap/extension-heading';
import BridgeExtension from './base';
export var HeadingEditorActionType;
(function (HeadingEditorActionType) {
    HeadingEditorActionType["ToggleHeading"] = "toggle-heading";
})(HeadingEditorActionType || (HeadingEditorActionType = {}));
export const HeadingBridge = new BridgeExtension({
    tiptapExtension: Heading,
    onBridgeMessage: (editor, message) => {
        if (message.type === HeadingEditorActionType.ToggleHeading) {
            editor.chain().focus().toggleHeading({ level: message.payload }).run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            toggleHeading: (level) => sendBridgeMessage({
                type: HeadingEditorActionType.ToggleHeading,
                payload: level,
            }),
        };
    },
    extendEditorState: (editor) => {
        var _a;
        return {
            canToggleHeading: editor.can().toggleHeading({ level: 1 }),
            headingLevel: (_a = editor.getAttributes('heading')) === null || _a === void 0 ? void 0 : _a.level,
        };
    },
});
