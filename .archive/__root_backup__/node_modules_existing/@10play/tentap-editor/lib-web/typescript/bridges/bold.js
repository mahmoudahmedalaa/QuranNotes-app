import Bold from '@tiptap/extension-bold';
import BridgeExtension from './base';
export var BoldEditorActionType;
(function (BoldEditorActionType) {
    BoldEditorActionType["ToggleBold"] = "toggle-bold";
})(BoldEditorActionType || (BoldEditorActionType = {}));
export const BoldBridge = new BridgeExtension({
    tiptapExtension: Bold,
    onBridgeMessage: (editor, message) => {
        if (message.type === BoldEditorActionType.ToggleBold) {
            editor.chain().focus().toggleBold().run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            toggleBold: () => sendBridgeMessage({ type: BoldEditorActionType.ToggleBold }),
        };
    },
    extendEditorState: (editor) => {
        return {
            canToggleBold: editor.can().toggleBold(),
            isBoldActive: editor.isActive('bold'),
        };
    },
});
