"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useEditorContent = useEditorContent;
var _debounce = _interopRequireDefault(require("lodash/debounce"));
var _react = require("react");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const DEFAULT_OPTIONS = {
  type: 'html',
  debounceInterval: 10
};
function useEditorContent(editor, {
  debounceInterval,
  type
} = DEFAULT_OPTIONS) {
  const [content, setContent] = (0, _react.useState)();
  (0, _react.useEffect)(() => {
    const updateContent = (0, _debounce.default)(async () => {
      switch (type) {
        case 'json':
          const json = await editor.getJSON();
          setContent(json);
          break;
        case 'text':
          const text = await editor.getText();
          setContent(text);
          break;
        case 'html':
        default:
          const html = await editor.getHTML();
          setContent(html);
          break;
      }
    }, debounceInterval);
    const unsubscribe = editor._subscribeToEditorStateUpdate(() => {
      updateContent();
    });
    return () => {
      unsubscribe();
    };
  }, [editor, debounceInterval, type]);
  return content;
}
//# sourceMappingURL=useEditorContent.js.map