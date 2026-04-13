import { OrderedList, ListItem } from '@tiptap/extension-list';
import BridgeExtension from './base';
export let OrderedListEditorActionType = /*#__PURE__*/function (OrderedListEditorActionType) {
  OrderedListEditorActionType["ToggleOrderedList"] = "toggle-orderedList";
  return OrderedListEditorActionType;
}({});
export const OrderedListBridge = new BridgeExtension({
  tiptapExtension: OrderedList,
  tiptapExtensionDeps: [ListItem],
  onBridgeMessage: (editor, message) => {
    if (message.type === OrderedListEditorActionType.ToggleOrderedList) {
      editor.chain().focus().toggleOrderedList().run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleOrderedList: () => sendBridgeMessage({
        type: OrderedListEditorActionType.ToggleOrderedList
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleOrderedList: editor.can().toggleOrderedList(),
      isOrderedListActive: editor.isActive('orderedList')
    };
  }
});
//# sourceMappingURL=orderedList.js.map