import Strike from '@tiptap/extension-strike';
import BridgeExtension from './base';
export var StrikeEditorActionType;
(function (StrikeEditorActionType) {
    StrikeEditorActionType["ToggleStrike"] = "toggle-strike";
})(StrikeEditorActionType || (StrikeEditorActionType = {}));
export const StrikeBridge = new BridgeExtension({
    tiptapExtension: Strike,
    onBridgeMessage: (editor, message) => {
        if (message.type === StrikeEditorActionType.ToggleStrike) {
            editor.chain().focus().toggleStrike().run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            toggleStrike: () => sendBridgeMessage({ type: StrikeEditorActionType.ToggleStrike }),
        };
    },
    extendEditorState: (editor) => {
        return {
            canToggleStrike: editor.can().toggleStrike(),
            isStrikeActive: editor.isActive('strike'),
        };
    },
});
