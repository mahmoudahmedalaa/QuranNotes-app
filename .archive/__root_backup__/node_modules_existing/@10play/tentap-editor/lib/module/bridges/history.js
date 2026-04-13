import { UndoRedo } from '@tiptap/extensions';
import BridgeExtension from './base';
export let HistoryEditorActionType = /*#__PURE__*/function (HistoryEditorActionType) {
  HistoryEditorActionType["Undo"] = "undo";
  HistoryEditorActionType["Redo"] = "redo";
  return HistoryEditorActionType;
}({});
export const HistoryBridge = new BridgeExtension({
  tiptapExtension: UndoRedo,
  onBridgeMessage: (editor, message) => {
    if (message.type === HistoryEditorActionType.Undo) {
      editor.chain().focus().undo().run();
    }
    if (message.type === HistoryEditorActionType.Redo) {
      editor.chain().focus().redo().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    const undo = () => sendBridgeMessage({
      type: HistoryEditorActionType.Undo
    });
    const redo = () => sendBridgeMessage({
      type: HistoryEditorActionType.Redo
    });
    return {
      redo,
      undo
    };
  },
  extendEditorState: editor => {
    var _editor$can$undo, _editor$can, _editor$can$redo, _editor$can2;
    return {
      canUndo: ((_editor$can$undo = (_editor$can = editor.can()).undo) === null || _editor$can$undo === void 0 ? void 0 : _editor$can$undo.call(_editor$can)) ?? false,
      canRedo: ((_editor$can$redo = (_editor$can2 = editor.can()).redo) === null || _editor$can$redo === void 0 ? void 0 : _editor$can$redo.call(_editor$can2)) ?? false
    };
  }
});
//# sourceMappingURL=history.js.map