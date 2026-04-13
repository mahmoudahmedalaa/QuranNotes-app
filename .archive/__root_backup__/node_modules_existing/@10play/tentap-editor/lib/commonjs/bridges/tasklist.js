"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TaskListEditorActionType = exports.TaskListBridge = void 0;
var _extensionList = require("@tiptap/extension-list");
var _base = _interopRequireDefault(require("./base"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let TaskListEditorActionType = exports.TaskListEditorActionType = /*#__PURE__*/function (TaskListEditorActionType) {
  TaskListEditorActionType["ToggleTaskList"] = "toggle-task-list";
  TaskListEditorActionType["LiftTaskListItem"] = "lift-task-list-item";
  TaskListEditorActionType["SinkTaskListItem"] = "sink-task-list-item";
  return TaskListEditorActionType;
}({});
const TaskListBridge = exports.TaskListBridge = new _base.default({
  tiptapExtension: _extensionList.TaskList,
  tiptapExtensionDeps: [_extensionList.TaskItem.configure({
    nested: true
  })],
  onBridgeMessage: (editor, message) => {
    if (message.type === TaskListEditorActionType.ToggleTaskList) {
      editor.chain().focus().toggleTaskList().run();
    }
    if (message.type === TaskListEditorActionType.LiftTaskListItem) {
      editor.chain().focus().liftListItem(editor.state.schema.nodes.taskItem.name).run();
    }
    if (message.type === TaskListEditorActionType.SinkTaskListItem) {
      editor.chain().focus().sinkListItem(editor.state.schema.nodes.taskItem.name).run();
    }
    return false;
  },
  extendEditorInstance: sendBridgeMessage => {
    return {
      toggleTaskList: () => sendBridgeMessage({
        type: TaskListEditorActionType.ToggleTaskList
      }),
      liftTaskListItem: () => sendBridgeMessage({
        type: TaskListEditorActionType.LiftTaskListItem
      }),
      sinkTaskListItem: () => sendBridgeMessage({
        type: TaskListEditorActionType.SinkTaskListItem
      })
    };
  },
  extendEditorState: editor => {
    return {
      canToggleTaskList: editor.can().toggleTaskList(),
      isTaskListActive: editor.isActive('taskList'),
      canLiftTaskListItem: editor.can().liftListItem(editor.state.schema.nodes.taskItem.name),
      canSinkTaskListItem: editor.can().sinkListItem(editor.state.schema.nodes.taskItem.name)
    };
  },
  extendCSS: `
  ul[data-type="taskList"] {
    list-style: none;
    padding: 0;
  }
  
  ul[data-type="taskList"] > li {
    display: flex;
  }
  
  ul[data-type="taskList"] p {
    margin: 0;
  }
  
  ul[data-type="taskList"] li {
    display: flex;
  }
  
  ul[data-type="taskList"] li > label > input {
    font-size: inherit;
    font-family: inherit;
    color: #000;
    margin: 0.1rem;
    border: 1px solid black;
    border-radius: 0.3rem;
    padding: 0.1rem 0.4rem;
    background: white;
    accent-color: black;
  }
  ul[data-type="taskList"] li > label {
    flex: 0 0 auto;
    margin-right: 0.5rem;
    user-select: none;
  }
  
  ul[data-type="taskList"] li > div {
    flex: 1 1 auto;
  }  
  `
});
//# sourceMappingURL=tasklist.js.map