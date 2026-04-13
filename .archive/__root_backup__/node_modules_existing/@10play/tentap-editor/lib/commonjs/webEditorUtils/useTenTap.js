"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useTenTap = exports.sendMessage = void 0;
var _debounce = _interopRequireDefault(require("lodash/debounce"));
var _react = require("react");
var _react2 = require("@tiptap/react");
var _Messaging = require("../types/Messaging");
var _core = require("../bridges/core");
var _HighlightSelection = require("../bridges/HighlightSelection");
var _contentHeight = require("./contentHeight");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const sendMessage = message => {
  var _window$ReactNativeWe;
  // @ts-ignore TODO fix type
  (_window$ReactNativeWe = window.ReactNativeWebView) === null || _window$ReactNativeWe === void 0 || _window$ReactNativeWe.postMessage(JSON.stringify(message));
};
exports.sendMessage = sendMessage;
// Wrapper for tiptap editor that will add specific mobile functionality and support tentap bridges
// args:
// tiptapOptions - all the options that tiptap editor accepts
// bridges - array of bridges that will be used to extend the editor
const useTenTap = options => {
  const {
    tiptapOptions = {},
    bridges = []
  } = options || {};
  const extensionConfigs = (0, _react.useMemo)(() => JSON.parse(window.bridgeExtensionConfigMap || '{}'), []);
  function filterExists(object) {
    return object !== null && object !== undefined;
  }
  const extensions = bridges.map(e => {
    const extensionConfig = extensionConfigs[e.name];
    if (!extensionConfig) return null;
    const {
      optionsConfig,
      extendConfig
    } = extensionConfig;
    return e.configureTiptapExtensionsOnRunTime(optionsConfig, extendConfig);
  }).filter(filterExists).flat();
  const tiptapOptionsWithExtensions = {
    ...tiptapOptions,
    extensions: [...(!window.disableColorHighlight ? [_HighlightSelection.blueBackgroundPlugin] : []), ...extensions, ...(tiptapOptions.extensions || [])]
  };
  const sendStateUpdate = (0, _debounce.default)(editor => {
    let payload = {};
    const state = bridges.reduce((acc, e) => {
      if (!e.extendEditorState) return acc;
      return Object.assign(acc, e.extendEditorState(editor));
    }, payload);
    sendMessage({
      type: _core.CoreEditorActionType.StateUpdate,
      payload: state
    });
  }, 10);
  const content = window.initialContent || '';
  const editor = (0, _react2.useEditor)({
    content,
    onCreate: () => sendMessage({
      type: _core.CoreEditorActionType.EditorReady,
      payload: undefined
    }),
    onUpdate: onUpdate => {
      sendStateUpdate(onUpdate.editor);
      sendMessage({
        type: _core.CoreEditorActionType.ContentUpdate,
        payload: undefined
      });
    },
    onSelectionUpdate: onUpdate => sendStateUpdate(onUpdate.editor),
    onTransaction: onUpdate => sendStateUpdate(onUpdate.editor),
    editable: window.editable,
    shouldRerenderOnTransaction: true,
    ...tiptapOptionsWithExtensions
  });
  (0, _react.useEffect)(() => {
    if (!editor) return;
    // Subscribe to editor message
    const handleEditorAction = action => {
      bridges.forEach(e => {
        e.onBridgeMessage && e.onBridgeMessage(editor, action, sendMessage);
      });
    };
    const handleWebviewMessage = event => {
      if (!(event instanceof MessageEvent)) return; // TODO check android
      const message = JSON.parse(event.data);
      if (message.type === _Messaging.EditorMessageType.Action) {
        // Workaround for https://github.com/react-native-webview/react-native-webview/issues/3305
        if (message.id) {
          // @ts-ignore
          if (window.lastMessageID === message.id) return;
          // @ts-ignore
          window.lastMessageID = message.id;
        }
        // Handle actions
        handleEditorAction(message.payload);
      }
    };
    // We need to listen to both window and document events because some platform get
    // webview messages from window and some from document
    window.addEventListener('message', handleWebviewMessage);
    document.addEventListener('message', handleWebviewMessage);
    return () => {
      window.removeEventListener('message', handleWebviewMessage);
      document.removeEventListener('message', handleWebviewMessage);
    };
  }, [editor, bridges]);
  (0, _react.useEffect)(() => {
    if (editor && !_contentHeight.contentHeightListener.connected && window.dynamicHeight) {
      const dynamicHeightDiv = document.querySelector('.dynamic-height');
      _contentHeight.contentHeightListener.connect(document.querySelector('.ProseMirror'), height => {
        // We need to reset the scroll position to fix a text jumping issue
        // to avoid an issue where text jumps https://github.com/10play/10tap-editor/issues/236 and https://github.com/10play/10tap-editor/issues/244
        if (dynamicHeightDiv) dynamicHeightDiv.scrollTop = 0;
        sendMessage({
          type: _core.CoreEditorActionType.DocumentHeight,
          payload: height
        });
      });
    }
  }, [editor]);
  return editor;
};
exports.useTenTap = useTenTap;
//# sourceMappingURL=useTenTap.js.map