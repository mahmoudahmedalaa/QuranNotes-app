import Image from '@tiptap/extension-image';
import BridgeExtension from './base';
export var ImageEditorActionType;
(function (ImageEditorActionType) {
    ImageEditorActionType["SetImage"] = "set-image";
})(ImageEditorActionType || (ImageEditorActionType = {}));
export const ImageBridge = new BridgeExtension({
    tiptapExtension: Image.configure({
        allowBase64: true,
    }),
    onBridgeMessage: (editor, message) => {
        if (message.type === ImageEditorActionType.SetImage) {
            editor
                .chain()
                .focus()
                .setImage({ src: message.payload })
                .setTextSelection(editor.state.selection.to + 1)
                .run();
        }
        return false;
    },
    extendEditorInstance: (sendBridgeMessage) => {
        return {
            setImage: (src) => sendBridgeMessage({
                type: ImageEditorActionType.SetImage,
                payload: src,
            }),
        };
    },
    extendEditorState: () => {
        return {};
    },
    extendCSS: `
  img {
    height: auto;
    max-width: 100%;
  }

  img &.ProseMirror-selectednode {
    outline: 3px solid #68cef8;
  }
  `,
});
