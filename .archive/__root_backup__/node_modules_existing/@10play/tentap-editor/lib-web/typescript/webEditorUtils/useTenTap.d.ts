import { Editor } from '@tiptap/core';
import { type EditorMessage } from '../types/Messaging';
import type BridgeExtension from '../bridges/base';
declare global {
    interface Window {
        initialContent: string;
        editable: string;
        bridgeExtensionConfigMap: string;
        whiteListBridgeExtensions: string[];
        dynamicHeight?: boolean;
        disableColorHighlight?: boolean;
        platform?: 'ios' | 'android' | 'web';
        ReactNativeWebView: {
            postMessage: (message: string) => void;
        };
    }
}
export declare const sendMessage: (message: EditorMessage) => void;
interface useTenTapArgs {
    tiptapOptions?: any;
    bridges?: BridgeExtension[];
}
export declare const useTenTap: (options?: useTenTapArgs) => Editor | null;
export {};
