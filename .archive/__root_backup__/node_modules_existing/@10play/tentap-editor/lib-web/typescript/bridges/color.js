import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import BridgeExtension from './base';
export var ColorEditorActionType;
(function (ColorEditorActionType) {
    ColorEditorActionType["SetColor"] = "set-color";
    ColorEditorActionType["UnsetColor"] = "unset-color";
})(ColorEditorActionType || (ColorEditorActionType = {}));
export const ColorBridge = new BridgeExtension({
    tiptapExtension: Color,
    tiptapExtensionDeps: [TextStyle],
    onBridgeMessage: (editor, { type, payload }) => {
        switch (type) {
            case ColorEditorActionType.SetColor:
                editor.chain().focus().setColor(payload).run();
                break;
            case ColorEditorActionType.UnsetColor:
                editor.chain().focus().unsetColor().run();
                break;
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            setColor: (color) => sendBridgeMessage({
                type: ColorEditorActionType.SetColor,
                payload: color,
            }),
            unsetColor: () => sendBridgeMessage({
                type: ColorEditorActionType.UnsetColor,
                payload: undefined,
            }),
        };
    },
    extendEditorState: (editor) => {
        return {
            activeColor: editor.getAttributes('textStyle').color,
        };
    },
});
