var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import BridgeExtension from './base';
import { asyncMessages } from '../RichText/AsyncMessages';
import { focusListener } from '../webEditorUtils/focusListener';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
export var CoreEditorActionType;
(function (CoreEditorActionType) {
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
})(CoreEditorActionType || (CoreEditorActionType = {}));
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
                    messageId: message.payload.messageId,
                },
            });
        }
        if (message.type === CoreEditorActionType.GetJSON) {
            sendMessageBack({
                type: CoreEditorActionType.SendJSONToNative,
                payload: {
                    content: editor.getJSON(),
                    messageId: message.payload.messageId,
                },
            });
        }
        if (message.type === CoreEditorActionType.GetText) {
            sendMessageBack({
                type: CoreEditorActionType.SendTextToNative,
                payload: {
                    content: editor.getText(),
                    messageId: message.payload.messageId,
                },
            });
        }
        if (message.type === CoreEditorActionType.SetSelection) {
            editor.commands.setTextSelection({
                from: message.payload.from,
                to: message.payload.to,
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
                        left: 0,
                    },
                    scrollMargin: { top: 0, bottom: message.payload, right: 0, left: 0 },
                },
            });
            return true;
        }
        if (message.type === CoreEditorActionType.SetEditable) {
            editor.setEditable(message.payload);
            return true;
        }
        return false;
    },
    onEditorMessage: ({ type, payload }, editorBridge) => {
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
            updateScrollThresholdAndMargin: (bottom) => sendBridgeMessage({
                type: CoreEditorActionType.UpdateScrollThresholdAndMargin,
                payload: bottom,
            }),
            setSelection: (from, to) => {
                sendBridgeMessage({
                    type: CoreEditorActionType.SetSelection,
                    payload: {
                        from,
                        to,
                    },
                });
            },
            setContent: (content) => {
                sendBridgeMessage({
                    type: CoreEditorActionType.SetContent,
                    payload: {
                        content,
                    },
                });
            },
            getHTML: () => __awaiter(void 0, void 0, void 0, function* () {
                const html = yield asyncMessages.sendAsyncMessage({
                    type: CoreEditorActionType.GetHTML,
                }, sendBridgeMessage);
                return html;
            }),
            getText: () => __awaiter(void 0, void 0, void 0, function* () {
                const text = yield asyncMessages.sendAsyncMessage({
                    type: CoreEditorActionType.GetText,
                }, sendBridgeMessage);
                return text;
            }),
            getJSON: () => __awaiter(void 0, void 0, void 0, function* () {
                const json = yield asyncMessages.sendAsyncMessage({
                    type: CoreEditorActionType.GetJSON,
                }, sendBridgeMessage);
                return json;
            }),
            focus: (pos) => {
                var _a;
                if (platform === 'android') {
                    setTimeout(() => {
                        var _a;
                        (_a = webviewRef === null || webviewRef === void 0 ? void 0 : webviewRef.current) === null || _a === void 0 ? void 0 : _a.requestFocus();
                        // Adding this for android, there is a race where the focus is not set if it's too close to Load
                        // https://github.com/react-native-webview/react-native-webview/issues/1172
                    }, 100);
                }
                else {
                    (_a = webviewRef === null || webviewRef === void 0 ? void 0 : webviewRef.current) === null || _a === void 0 ? void 0 : _a.requestFocus();
                }
                if (editorStateRef && editorStateRef.current) {
                    _updateEditorState &&
                        _updateEditorState(Object.assign(Object.assign({}, editorStateRef.current), { isFocused: true }));
                }
                sendBridgeMessage({
                    type: CoreEditorActionType.Focus,
                    payload: pos,
                });
            },
            blur: () => {
                sendBridgeMessage({
                    type: CoreEditorActionType.Blur,
                    payload: undefined,
                });
            },
            injectJS: (js) => {
                var _a;
                (_a = webviewRef === null || webviewRef === void 0 ? void 0 : webviewRef.current) === null || _a === void 0 ? void 0 : _a.injectJavaScript(js);
            },
            setEditable: (editable) => {
                sendBridgeMessage({
                    type: CoreEditorActionType.SetEditable,
                    payload: editable,
                });
            },
        };
    },
    extendEditorState: (editor) => {
        return {
            isFocused: focusListener.isFocused,
            isReady: true,
            selection: {
                from: editor.state.selection.from,
                to: editor.state.selection.to,
            },
            editable: editor.isEditable,
            empty: editor.isEmpty,
        };
    },
});
