"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ListItemEditorActionType = exports.ListItemBridge = void 0;
var _extensionList = require("@tiptap/extension-list");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let ListItemEditorActionType = exports.ListItemEditorActionType = /*#__PURE__*/function (ListItemEditorActionType) {
  ListItemEditorActionType["Lift"] = "lift";
  ListItemEditorActionType["Sink"] = "sink";
  return ListItemEditorActionType;
}({}); // Actions with no payload
const ListItemBridge = exports.ListItemBridge = new _base.default({
  tiptapExtension: _extensionList.ListItem,
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