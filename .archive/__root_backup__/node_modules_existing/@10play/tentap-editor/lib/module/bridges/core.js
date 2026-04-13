import BridgeExtension from './base';
import { asyncMessages } from '../RichText/AsyncMessages';
import { focusListener } from '../webEditorUtils/focusListener';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
export let CoreEditorActionType = /*#__PURE__*/function (CoreEditorActionType) {
  CoreEditorActionType["SetSelection"] = "set-selection";
  CoreEditorActionType["GetHTML"] = "get-html";
  CoreEditorActionType["GetJSON"] = "get-json";
  CoreEditorActionType["GetText"] = "get-text";
  CoreEditorActionType["SendHTMLToNative"] = "send-html-back";
  CoreEditorActionType["SendTextToNative"] = "send-text-back";
  CoreEditorActionType["SendJSONToNative"] = "send-json-back";
  CoreEditorActionType["SetContent"] = "set-content";
  CoreEditorActionType["StateUpdate"] = "stateUpdate";
  CoreEditorActionType["Focus"] = "focus";
  CoreEditorActionType["Blur"] = "blur";
  CoreEditorActionType["EditorReady"] = "editor-ready";
  CoreEditorActionType["UpdateScrollThresholdAndMargin"] = "update-scroll-threshold-and-margin";
  CoreEditorActionType["ContentUpdate"] = "content-update";
  CoreEditorActionType["DocumentHeight"] = "document-height";
  CoreEditorActionType["SetEditable"] = "set-editable";
  return CoreEditorActionType;
}({});
export const CoreBridge = new BridgeExtension({
  forceName: 'coreBridge',
  tiptapExtension: Document,
  tiptapExtensionDeps: [Paragraph, Text],
  onBridgeMessage: (editor, message, sendMessageBack) => {
    if (message.type === CoreEditorActionType.SetContent) {
      editor.commands.setContent(message.payload.content);
      return true;
    }
    if (message.type === CoreEditorActionType.GetHTML) {
      sendMessageBack({
        type: CoreEditorActionType.SendHTMLToNative,
        payload: {
          content: editor.getHTML(),
          messageId: message.payload.messageId
        }
      });
    }
    if (message.type === CoreEditorActionType.GetJSON) {
      sendMessageBack({
        type: CoreEditorActionType.SendJSONToNative,
        payload: {
          content: editor.getJSON(),
          messageId: message.payload.messageId
        }
      });
    }
    if (message.type === CoreEditorActionType.GetText) {
      sendMessageBack({
        type: CoreEditorActionType.SendTextToNative,
        payload: {
          content: editor.getText(),
          messageId: message.payload.messageId
        }
      });
    }
    if (message.type === CoreEditorActionType.SetSelection) {
      editor.commands.setTextSelection({
        from: message.payload.from,
        to: message.payload.to
      });
      return true;
    }
    if (message.type === CoreEditorActionType.Focus) {
      editor.commands.focus(message.payload);
      return true;
    }
    if (message.type === CoreEditorActionType.Blur) {
      editor.commands.blur();
      return true;
    }
    if (message.type === CoreEditorActionType.UpdateScrollThresholdAndMargin) {
      editor.setOptions({
        editorProps: {
          scrollThreshold: {
            top: 0,
            bottom: message.payload,
            right: 0,
            left: 0
          },
          scrollMargin: {
            top: 0,
            bottom: message.payload,
            right: 0,
            left: 0
          }
        }
      });
      return true;
    }
    if (message.type === CoreEditorActionType.SetEditable) {
      editor.setEditable(message.payload);
      return true;
    }
    return false;
  },
  onEditorMessage: ({
    type,
    payload
  }, editorBridge) => {
    if (type === CoreEditorActionType.SendHTMLToNative) {
      asyncMessages.onMessage(payload.messageId, payload.content);
      return true;
    }
    if (type === CoreEditorActionType.SendTextToNative) {
      asyncMessages.onMessage(payload.messageId, payload.content);
      return true;
    }
    if (type === CoreEditorActionType.SendJSONToNative) {
      asyncMessages.onMessage(payload.messageId, payload.content);
      return true;
    }
    if (type === CoreEditorActionType.EditorReady) {
      if (editorBridge.autofocus) {
        editorBridge.focus('end');
      }
    }
    if (type === CoreEditorActionType.StateUpdate) {
      editorBridge._updateEditorState(payload);
    }
    if (type === CoreEditorActionType.ContentUpdate) {
      editorBridge._onContentUpdate();
    }
    return false;
  },
  extendEditorInstance: (sendBridgeMessage, webviewRef, editorStateRef, _updateEditorState, platform) => {
    return {
      updateScrollThresholdAndMargin: bottom => sendBridgeMessage({
        type: CoreEditorActionType.UpdateScrollThresholdAndMargin,
        payload: bottom
      }),
      setSelection: (from, to) => {
        sendBridgeMessage({
          type: CoreEditorActionType.SetSelection,
          payload: {
            from,
            to
          }
        });
      },
      setContent: content => {
        sendBridgeMessage({
          type: CoreEditorActionType.SetContent,
          payload: {
            content
          }
        });
      },
      getHTML: async () => {
        const html = await asyncMessages.sendAsyncMessage({
          type: CoreEditorActionType.GetHTML
        }, sendBridgeMessage);
        return html;
      },
      getText: async () => {
        const text = await asyncMessages.sendAsyncMessage({
          type: CoreEditorActionType.GetText
        }, sendBridgeMessage);
        return text;
      },
      getJSON: async () => {
        const json = await asyncMessages.sendAsyncMessage({
          type: CoreEditorActionType.GetJSON
        }, sendBridgeMessage);
        return json;
      },
      focus: pos => {
        if (platform === 'android') {
          setTimeout(() => {
            var _webviewRef$current;
            webviewRef === null || webviewRef === void 0 || (_webviewRef$current = webviewRef.current) === null || _webviewRef$current === void 0 || _webviewRef$current.requestFocus();
            // Adding this for android, there is a race where the focus is not set if it's too close to Load
            // https://github.com/react-native-webview/react-native-webview/issues/1172
          }, 100);
        } else {
          var _webviewRef$current2;
          webviewRef === null || webviewRef === void 0 || (_webviewRef$current2 = webviewRef.current) === null || _webviewRef$current2 === void 0 || _webviewRef$current2.requestFocus();
        }
        if (editorStateRef && editorStateRef.current) {
          _updateEditorState && _updateEditorState({
            ...editorStateRef.current,
            isFocused: true
          });
        }
        sendBridgeMessage({
          type: CoreEditorActionType.Focus,
          payload: pos
        });
      },
      blur: () => {
        sendBridgeMessage({
          type: CoreEditorActionType.Blur,
          payload: undefined
        });
      },
      injectJS: js => {
        var _webviewRef$current3;
        webviewRef === null || webviewRef === void 0 || (_webviewRef$current3 = webviewRef.current) === null || _webviewRef$current3 === void 0 || _webviewRef$current3.injectJavaScript(js);
      },
      setEditable: editable => {
        sendBridgeMessage({
          type: CoreEditorActionType.SetEditable,
          payload: editable
        });
      }
    };
  },
  extendEditorState: editor => {
    return {
      isFocused: focusListener.isFocused,
      isReady: true,
      selection: {
        from: editor.state.selection.from,
        to: editor.state.selection.to
      },
      editable: editor.isEditable,
      empty: editor.isEmpty
    };
  }
});
//# sourceMappingURL=core.js.map