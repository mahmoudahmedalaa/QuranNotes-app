import Code from '@tiptap/extension-code';
import BridgeExtension from './base';
export var CodeEditorActionType;
(function (CodeEditorActionType) {
    CodeEditorActionType["ToggleCode"] = "toggle-code";
})(CodeEditorActionType || (CodeEditorActionType = {}));
export const CodeBridge = new BridgeExtension({
    tiptapExtension: Code,
    //   tiptapExtensionDeps: [CodeBlock],
    onBridgeMessage: (editor, message) => {
        if (message.type === CodeEditorActionType.ToggleCode) {
            editor.chain().focus().toggleCode().run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            toggleCode: () => sendBridgeMessage({ type: CodeEditorActionType.ToggleCode }),
        };
    },
    extendEditorState: (editor) => {
        return {
            canToggleCode: editor.can().toggleCode(),
            isCodeActive: editor.isActive('code'),
        };
    },
    extendCSS: `
    code {
        background-color: #6161611a;
        border-radius: 0.25em;
        box-decoration-break: clone;
        color: #616161;
        font-size: 0.9rem;
        padding: 0.25em;
    }
  `,
});
