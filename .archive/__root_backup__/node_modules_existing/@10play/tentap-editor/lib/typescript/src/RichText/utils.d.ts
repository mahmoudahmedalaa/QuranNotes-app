import type BridgeExtension from '../bridges/base';
import type { EditorBridge } from '../types';
/**
 * Creates a new style element and appends it to the head of the document.
 * If the style element already exists, it will update the content of the existing element.
 * @param css - array of css strings
 * @param styleSheetTag - a unique tag to identify the style element - if not provided, a new style element will be created
 * @returns a string of javascript that is ready to be injected into the rich text webview
 */
export declare const getStyleSheetCSS: (css: string, styleSheetTag: string) => string;
export declare const getInjectedJS: (bridgeExtensions: BridgeExtension[]) => string;
/**
 * Get js code to inject into webview before the content loads
 */
export declare const getInjectedJSBeforeContentLoad: (editor: EditorBridge) => string;
//# sourceMappingURL=utils.d.ts.map