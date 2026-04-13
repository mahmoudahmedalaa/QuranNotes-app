import { ListItem } from '@tiptap/extension-list';
import BridgeExtension from './base';
export let ListItemEditorActionType = /*#__PURE__*/function (ListItemEditorActionType) {
  ListItemEditorActionType["Lift"] = "lift";
  ListItemEditorActionType["Sink"] = "sink";
  return ListItemEditorActionType;
}({});

// Actions with no payload

export const ListItemBridge = new BridgeExtension({
  tiptapExtension: ListItem,
  onBridgeMessage: (editor, message) => {
    switch (message.type) {
      case ListItemEditorActionType.Lift:
        editor.chain().focus().liftListItem(editor.schema.nodes.listItem.name).run();
        break;
      case ListItemEditorActionType.Sink:
        editor.chain().focus().sinkListItem(editor.schema.nodes.listItem.name).run();
        break;
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    const lift = () => sendBridgeMessage({
      type: ListItemEditorActionType.Lift
    });
    const sink = () => sendBridgeMessage({
      type: ListItemEditorActionType.Sink
    });
    return {
      lift,
      sink
    };
  },
  extendEditorState: editor => {
    return {
      canLift: editor.can().liftListItem(editor.state.schema.nodes.listItem.name),
      canSink: editor.can().sinkListItem(editor.state.schema.nodes.listItem.name)
    };
  }
});
//# sourceMappingURL=listItem.js.map