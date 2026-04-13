"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useEditorBridge = void 0;
var _react = require("react");
var _cloneDeep = _interopRequireDefault(require("lodash/cloneDeep"));
var _Messaging = require("../types/Messaging");
var _EditorHelper = require("./EditorHelper");
var _StarterKit = require("../bridges/StarterKit");
var _utils = require("../utils");
var _theme = require("./theme");
var _utils2 = require("./utils");
var _mergeThemes = require("../utils/mergeThemes");
var _misc = require("../utils/misc");
var _reactNative = require("react-native");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const useEditorBridge = options => {
  const webviewRef = (0, _react.useRef)(null);
  // Till we will implement default per bridgeExtension
  const editorStateRef = (0, _react.useRef)({});
  const editorStateSubsRef = (0, _react.useRef)([]);
  const editorContentSubsRef = (0, _react.useRef)([]);
  const bridgeExtensions = (0, _react.useMemo)(() => {
    const extensions = (options === null || options === void 0 ? void 0 : options.bridgeExtensions) || _StarterKit.TenTapStartKit;
    // Filter out duplicates - the last one wins
    return (0, _utils.uniqueBy)(extensions, 'name');
  }, [options === null || options === void 0 ? void 0 : options.bridgeExtensions]);
  const mergedTheme = (0, _react.useMemo)(
  // We must deep clone defaultEditorTheme, because it is read only
  () => (0, _mergeThemes.mergeThemes)((0, _cloneDeep.default)(_theme.defaultEditorTheme), options === null || options === void 0 ? void 0 : options.theme), [options === null || options === void 0 ? void 0 : options.theme]);
  const editable = (options === null || options === void 0 ? void 0 : options.editable) === undefined ? true : options.editable;
  (0, _react.useEffect)(() => {
    if (!webviewRef.current) return;
    if (options) {
      // Special case for editable prop, since its command is on the core bridge and we want to access it via useEditorBridge
      editorInstance === null || editorInstance === void 0 || editorInstance.setEditable(editable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, webviewRef.current]);
  const _updateEditorState = editorState => {
    editorStateRef.current = editorState;
    editorStateSubsRef.current.forEach(sub => sub(editorState));
  };
  const _onContentUpdate = () => {
    var _options$onChange;
    editorContentSubsRef.current.forEach(sub => sub());
    options === null || options === void 0 || (_options$onChange = options.onChange) === null || _options$onChange === void 0 || _options$onChange.call(options);
  };
  const _subscribeToEditorStateUpdate = cb => {
    editorStateSubsRef.current.push(cb);
    return () => {
      editorStateSubsRef.current = editorStateSubsRef.current.filter(sub => sub !== cb);
    };
  };
  const _subscribeToContentUpdate = cb => {
    editorContentSubsRef.current.push(cb);
    return () => {
      editorContentSubsRef.current = editorContentSubsRef.current.filter(sub => sub !== cb);
    };
  };
  const getEditorState = () => {
    return editorStateRef.current;
  };
  const sendMessage = message => {
    var _webviewRef$current;
    if (!webviewRef.current) return console.warn("Editor isn't ready yet");

    // Workaround for https://github.com/react-native-webview/react-native-webview/issues/3305
    // On the new arch on Android, messages are sent twice, so if we toggle bold it immediately toggles back
    // We workaround this by adding a random id to the message and not handling it twice on the web side
    if ((0, _misc.isFabric)() && _reactNative.Platform.OS === 'android') {
      message.id = Math.random().toString(36).substring(7);
    }
    (_webviewRef$current = webviewRef.current) === null || _webviewRef$current === void 0 || _webviewRef$current.postMessage(JSON.stringify(message));
  };
  const sendAction = action => {
    sendMessage({
      type: _Messaging.EditorMessageType.Action,
      payload: action
    });
  };

  /**
   * Injects custom css stylesheet, if stylesheet exists with the same tag, it will be replaced
   * @param cssString css to inject
   * @param tag optional - tag to identify the style element
   */
  const injectCSS = (cssString, tag = 'custom-css') => {
    var _webviewRef$current2;
    // Generate custom stylesheet with `custom-css` tag
    const customCSS = (0, _utils2.getStyleSheetCSS)(cssString, tag);
    (_webviewRef$current2 = webviewRef.current) === null || _webviewRef$current2 === void 0 || _webviewRef$current2.injectJavaScript(customCSS);
  };

  // Disable color highlight on Android if not passed
  // see: https://github.com/10play/10tap-editor/issues/184
  const disableColorHighlight = (options === null || options === void 0 ? void 0 : options.disableColorHighlight) === undefined ? !!(_reactNative.Platform.OS === 'android') : options === null || options === void 0 ? void 0 : options.disableColorHighlight;
  const editorBridge = {
    bridgeExtensions,
    initialContent: options === null || options === void 0 ? void 0 : options.initialContent,
    autofocus: options === null || options === void 0 ? void 0 : options.autofocus,
    dynamicHeight: options === null || options === void 0 ? void 0 : options.dynamicHeight,
    disableColorHighlight: disableColorHighlight,
    avoidIosKeyboard: options === null || options === void 0 ? void 0 : options.avoidIosKeyboard,
    customSource: options === null || options === void 0 ? void 0 : options.customSource,
    editable,
    webviewBaseURL: options === null || options === void 0 ? void 0 : options.webviewBaseURL,
    DEV_SERVER_URL: options === null || options === void 0 ? void 0 : options.DEV_SERVER_URL,
    DEV: options === null || options === void 0 ? void 0 : options.DEV,
    webviewRef,
    theme: mergedTheme,
    getEditorState,
    injectCSS,
    _updateEditorState,
    _subscribeToEditorStateUpdate,
    _onContentUpdate,
    _subscribeToContentUpdate
  };
  const editorInstance = (bridgeExtensions || []).reduce((acc, cur) => {
    if (!cur.extendEditorInstance) return acc;
    return Object.assign(acc, cur.extendEditorInstance(sendAction, webviewRef, editorStateRef, _updateEditorState, _reactNative.Platform.OS), webviewRef, editorStateRef.current, _updateEditorState);
  }, editorBridge); // TODO fix type

  _EditorHelper.EditorHelper.setEditorLastInstance(editorInstance);
  return editorInstance;
};
exports.useEditorBridge = useEditorBridge;
//# sourceMappingURL=useEditorBridge.js.map