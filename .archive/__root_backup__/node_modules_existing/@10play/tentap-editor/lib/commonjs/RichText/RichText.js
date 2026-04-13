"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RichText = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _reactNativeWebview = require("react-native-webview");
var _editorHtml = require("../simpleWebEditor/build/editorHtml");
var _utils = require("../utils");
var _utils2 = require("./utils");
var _misc = require("../utils/misc");
var _core = require("../bridges/core");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
const styles = _reactNative.StyleSheet.create({
  hiddenInput: {
    display: 'none',
    width: 0,
    height: 0,
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0
  }
});
const DEV_SERVER_URL = 'http://localhost:3000';

// TODO: make it a prop
const TOOLBAR_HEIGHT = 44;
const RichText = ({
  editor,
  onMessage,
  exclusivelyUseCustomOnMessage = true,
  ...props
}) => {
  const [editorHeight, setEditorHeight] = (0, _react.useState)(0);
  const [key, setKey] = (0, _react.useState)('webview');
  const [loaded, setLoaded] = (0, _react.useState)((0, _misc.isFabric)());
  const {
    keyboardHeight,
    isKeyboardUp
  } = (0, _utils.useKeyboard)();
  const source = editor.DEV ? {
    uri: editor.DEV_SERVER_URL || DEV_SERVER_URL
  } : {
    html: editor.customSource || _editorHtml.editorHtml,
    baseUrl: editor.webviewBaseURL
  };
  const onWebviewMessage = event => {
    var _editor$bridgeExtensi;
    onMessage && onMessage(event);
    if (exclusivelyUseCustomOnMessage && onMessage) return;
    const {
      data
    } = event.nativeEvent;
    // on expo-web we sometimes get react-dev messages that come in as objects - so we ignore these
    if (typeof data !== 'string') return;
    // Parse the message sent from the editor
    const {
      type,
      payload
    } = JSON.parse(data);
    if (type === _core.CoreEditorActionType.DocumentHeight) {
      setEditorHeight(payload);
    }
    (_editor$bridgeExtensi = editor.bridgeExtensions) === null || _editor$bridgeExtensi === void 0 || _editor$bridgeExtensi.forEach(e => {
      e.onEditorMessage && e.onEditorMessage({
        type,
        payload
      }, editor);
    });
  };
  (0, _react.useEffect)(() => {
    const setDocBottomPadding = height => {
      if (editor.webviewRef.current) {
        editor.webviewRef.current.injectJavaScript(`
          doc = document.querySelector('.ProseMirror');
          if(doc) doc.style.paddingBottom = '${height}px';
        `);
      }
    };
    if (editor.webviewRef.current && _reactNative.Platform.OS === 'android') {
      // In case the keyboard is up we need to add padding to the bottom of the document
      const paddingThreshold = editor.avoidIosKeyboard && keyboardHeight && isKeyboardUp // avoidIosKeyboard should change to avoidKeyboard because used in android too (v1.0.0)
      ? TOOLBAR_HEIGHT : 0;
      setTimeout(() => {
        setDocBottomPadding(paddingThreshold);
        editor.updateScrollThresholdAndMargin(paddingThreshold);
      }, 200);
    }
    // On iOS we want to control the scroll and not use the scrollview that comes with react-native-webview
    // That's way we can get better exp on scroll and scroll to element when we need to
    if (editor.avoidIosKeyboard && editor.webviewRef.current && _reactNative.Platform.OS === 'ios') {
      if (keyboardHeight) {
        setDocBottomPadding(keyboardHeight + 10);
        editor.updateScrollThresholdAndMargin(keyboardHeight + 10);
      } else {
        setDocBottomPadding(0);
        editor.updateScrollThresholdAndMargin(0);
      }
    }
  }, [editor.avoidIosKeyboard, editor, keyboardHeight, isKeyboardUp]);
  const injectedJavaScript = (0, _react.useMemo)(() => (0, _utils2.getInjectedJS)(editor.bridgeExtensions || []), [editor.bridgeExtensions]);
  return /*#__PURE__*/_react.default.createElement(_react.default.Fragment, null, editor.autofocus && _reactNative.Platform.OS === 'android' && /*#__PURE__*/_react.default.createElement(_reactNative.TextInput, {
    autoFocus: true,
    style: styles.hiddenInput
  }), /*#__PURE__*/_react.default.createElement(_reactNativeWebview.WebView, _extends({
    scrollEnabled: false,
    key: key,
    style: [RichTextStyles.fullScreen, {
      display: loaded ? 'flex' : 'none'
    }, editor.theme.webview],
    containerStyle: [editor.theme.webviewContainer, {
      height: editor.dynamicHeight ? editorHeight : undefined
    }],
    source: source,
    injectedJavaScript: injectedJavaScript,
    injectedJavaScriptBeforeContentLoaded: (0, _utils2.getInjectedJSBeforeContentLoad)(editor),
    hideKeyboardAccessoryView: true,
    onMessage: onWebviewMessage,
    ref: editor.webviewRef,
    webviewDebuggingEnabled: __DEV__,
    keyboardDisplayRequiresUserAction: false
  }, props, {
    // Propagated Props
    onLoad: e => {
      setLoaded(true);
      // This is a workaround for iOS to make sure the webview is loaded
      // See https://github.com/react-native-webview/react-native-webview/issues/3578
      if (_reactNative.Platform.OS === 'ios' && key === 'webview') {
        setKey('webview_reloaded');
      }
      props.onLoad && props.onLoad(e);
    }
  })));
};
exports.RichText = RichText;
const RichTextStyles = _reactNative.StyleSheet.create({
  fullScreen: {
    flex: 1
  }
});
//# sourceMappingURL=RichText.js.map