"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRemoteEditorBridge = exports.EditorHelper = void 0;
var _react = require("react");
class _EditorHelper {
  cbs = [];
  constructor() {
    this.editorLastInstance = undefined;
  }
  setEditorLastInstance(editorLastInstance) {
    this.editorLastInstance = editorLastInstance;
    this.cbs.forEach(cb => {
      cb(editorLastInstance);
    });
  }
  subscribe = cb => {
    this.cbs.push(cb);
    return () => {
      this.cbs = this.cbs.filter(sub => sub !== cb);
    };
  };
}
const EditorHelper = exports.EditorHelper = new _EditorHelper();
const useRemoteEditorBridge = () => {
  const [editor, _setEditor] = (0, _react.useState)(EditorHelper.editorLastInstance);

  // TODO -
  // There is currently a bug on ios where the keyboard isn't unmounted RCTRootView isn't unmounted
  // When removed from subview, because of this we can't rely on it to unsubscribe. Once this is fixed we can
  // add this again make it be reactive
  // useEffect(() => {
  //   const unsubscribe = EditorHelper.subscribe((editor) => {
  //     setEditor(editor);
  //   });

  //   return () => {
  //     unsubscribe();
  //   };
  // }, []);

  return editor;
};
exports.useRemoteEditorBridge = useRemoteEditorBridge;
//# sourceMappingURL=EditorHelper.js.map