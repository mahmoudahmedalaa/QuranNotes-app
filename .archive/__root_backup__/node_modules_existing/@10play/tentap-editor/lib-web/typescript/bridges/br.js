import HardBreak from '@tiptap/extension-hard-break';
import BridgeExtension from './base';
export var HardBreakEditorActionType;
(function (HardBreakEditorActionType) {
    HardBreakEditorActionType["setHardBreak"] = "set-hard-break";
})(HardBreakEditorActionType || (HardBreakEditorActionType = {}));
export const HardBreakBridge = new BridgeExtension({
    tiptapExtension: HardBreak,
    onBridgeMessage: (editor, message) => {
        if (message.type === HardBreakEditorActionType.setHardBreak) {
            console.log('setting hard break');
            editor.chain().focus().setHardBreak().run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            setHardBreak: () => sendBridgeMessage({ type: HardBreakEditorActionType.setHardBreak }),
        };
    },
    extendEditorState: () => {
        return {};
    },
});
