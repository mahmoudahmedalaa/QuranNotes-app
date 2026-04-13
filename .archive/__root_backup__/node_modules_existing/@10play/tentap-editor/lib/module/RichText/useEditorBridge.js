import { useEffect, useMemo, useRef } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { EditorMessageType } from '../types/Messaging';
import { EditorHelper } from './EditorHelper';
import { TenTapStartKit } from '../bridges/StarterKit';
import { uniqueBy } from '../utils';
import { defaultEditorTheme } from './theme';
import { getStyleSheetCSS } from './utils';
import { mergeThemes } from '../utils/mergeThemes';
import { isFabric } from '../utils/misc';
import { Platform } from 'react-native';
export const useEditorBridge = options => {
  const webviewRef = useRef(null);
  // Till we will implement default per bridgeExtension
  const editorStateRef = useRef({});
  const editorStateSubsRef = useRef([]);
  const editorContentSubsRef = useRef([]);
  const bridgeExtensions = useMemo(() => {
    const extensions = (options === null || options === void 0 ? void 0 : options.bridgeExtensions) || TenTapStartKit;
    // Filter out duplicates - the last one wins
    return uniqueBy(extensions, 'name');
  }, [options === null || options === void 0 ? void 0 : options.bridgeExtensions]);
  const mergedTheme = useMemo(
  // We must deep clone defaultEditorTheme, because it is read only
  () => mergeThemes(cloneDeep(defaultEditorTheme), options === null || options === void 0 ? void 0 : options.theme), [options === null || options === void 0 ? void 0 : options.theme]);
  const editable = (options === null || options === void 0 ? void 0 : options.editable) === undefined ? true : options.editable;
  useEffect(() => {
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
    if (isFabric() && Platform.OS === 'android') {
      message.id = Math.random().toString(36).substring(7);
    }
    (_webviewRef$current = webviewRef.current) === null || _webviewRef$current === void 0 || _webviewRef$current.postMessage(JSON.stringify(message));
  };
  const sendAction = action => {
    sendMessage({
      type: EditorMessageType.Action,
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
    const customCSS = getStyleSheetCSS(cssString, tag);
    (_webviewRef$current2 = webviewRef.current) === null || _webviewRef$current2 === void 0 || _webviewRef$current2.injectJavaScript(customCSS);
  };

  // Disable color highlight on Android if not passed
  // see: https://github.com/10play/10tap-editor/issues/184
  const disableColorHighlight = (options === null || options === void 0 ? void 0 : options.disableColorHighlight) === undefined ? !!(Platform.OS === 'android') : options === null || options === void 0 ? void 0 : options.disableColorHighlight;
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
    return Object.assign(acc, cur.extendEditorInstance(sendAction, webviewRef, editorStateRef, _updateEditorState, Platform.OS), webviewRef, editorStateRef.current, _updateEditorState);
  }, editorBridge); // TODO fix type

  EditorHelper.setEditorLastInstance(editorInstance);
  return editorInstance;
};
//# sourceMappingURL=useEditorBridge.js.map