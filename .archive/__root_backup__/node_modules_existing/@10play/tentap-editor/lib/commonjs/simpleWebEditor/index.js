"use strict";

var _react = _interopRequireDefault(require("react"));
var _client = require("react-dom/client");
var _Tiptap = _interopRequireDefault(require("./Tiptap"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * On android - react-native-webview there is a bug where sometimes the content
 * is injected after the window is loaded https://github.com/react-native-webview/react-native-webview/pull/2960
 * To overcome this we will check if the content is injected before rendering the editor
 */
const contentInjected = () => window.contentInjected;
let interval;
interval = setInterval(() => {
  if (!contentInjected()) return;
  // Once content is injected into the webview, we can render the editor
  const container = document.getElementById('root');
  const root = (0, _client.createRoot)(container);
  root.render( /*#__PURE__*/_react.default.createElement(_Tiptap.default, null));
  clearInterval(interval);
  return;
}, 1);
//# sourceMappingURL=index.js.map