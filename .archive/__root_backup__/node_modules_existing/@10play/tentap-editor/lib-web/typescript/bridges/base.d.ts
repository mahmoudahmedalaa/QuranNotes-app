import { Editor, type AnyExtension } from '@tiptap/core';
import type { EditorBridge, BridgeState } from '../types';
import type WebView from 'react-native-webview';
import type { RefObject } from 'react';
interface BridgeExtension<T = any, E = any, M = any> {
    name: string;
    tiptapExtension?: AnyExtension;
    tiptapExtensionDeps?: AnyExtension[];
    onBridgeMessage?: (editor: Editor, message: M, sendMessageBack: (message: M) => void) => boolean;
    onEditorMessage?: (message: M, editorBridge: EditorBridge) => boolean;
    extendEditorState?: (editor: Editor) => T;
    extendEditorInstance?: (sendBridgeMessage: (message: M) => void, webviewRef?: RefObject<WebView>, editorState?: RefObject<BridgeState | {}>, _setEditorState?: (editorState: BridgeState) => void, platform?: string) => E;
    extendCSS?: string | undefined;
    config?: any;
    extendConfig?: any;
}
type CreateTenTapBridgeArgs<T = any, E = any, M = any> = Omit<BridgeExtension<T, E, M> & {
    forceName?: string;
}, 'name' | 'sendMessage' | 'configureExtension' | 'configureTiptapExtensionsOnRunTime' | 'configureCSS' | 'extendExtension' | 'clone'>;
declare class BridgeExtension<T = any, E = any, M = any> {
    constructor({ forceName, tiptapExtension, tiptapExtensionDeps, onBridgeMessage, onEditorMessage, extendEditorState, extendEditorInstance, extendCSS, config, extendConfig, }: CreateTenTapBridgeArgs<T, E, M>);
    clone(): BridgeExtension<T, E, M>;
    configureExtension(config: any): BridgeExtension<T, E, M>;
    configureCSS(css: string): BridgeExtension<T, E, M>;
    extendExtension(config: any): BridgeExtension<T, E, M>;
    configureTiptapExtensionsOnRunTime(config: any, extendConfig: any): (AnyExtension | undefined)[];
}
export default BridgeExtension;
