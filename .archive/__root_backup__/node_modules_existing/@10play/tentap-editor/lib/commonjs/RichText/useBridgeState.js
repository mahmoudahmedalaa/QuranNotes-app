"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useBridgeState = void 0;
var _react = require("react");
const useBridgeState = editor => {
  const [editorState, setEditorState] = (0, _react.useState)(editor.getEditorState());
  (0, _react.useEffect)(() => {
    const unsubscribe = editor._subscribeToEditorStateUpdate(setEditorState);
    return unsubscribe;
  }, [editor]);
  return editorState;
};
exports.useBridgeState = useBridgeState;
//# sourceMappingURL=useBridgeState.js.map