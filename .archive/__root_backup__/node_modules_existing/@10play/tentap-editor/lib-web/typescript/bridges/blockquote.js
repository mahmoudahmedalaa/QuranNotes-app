import Blockquote from '@tiptap/extension-blockquote';
import BridgeExtension from './base';
export var BlockquoteEditorActionType;
(function (BlockquoteEditorActionType) {
    BlockquoteEditorActionType["ToggleBlockquote"] = "toggle-blockquote";
})(BlockquoteEditorActionType || (BlockquoteEditorActionType = {}));
export const BlockquoteBridge = new BridgeExtension({
    tiptapExtension: Blockquote,
    onBridgeMessage: (editor, message) => {
        if (message.type === BlockquoteEditorActionType.ToggleBlockquote) {
            editor.chain().focus().toggleBlockquote().run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            toggleBlockquote: () => sendBridgeMessage({
                type: BlockquoteEditorActionType.ToggleBlockquote,
            }),
        };
    },
    extendEditorState: (editor) => {
        return {
            canToggleBlockquote: editor.can().toggleBlockquote(),
            isBlockquoteActive: editor.isActive('blockquote'),
        };
    },
    extendCSS: `
    blockquote {
        border-left: 3px solid #0d0d0d1a;
        padding-left: 1rem;
    }
  `,
});
