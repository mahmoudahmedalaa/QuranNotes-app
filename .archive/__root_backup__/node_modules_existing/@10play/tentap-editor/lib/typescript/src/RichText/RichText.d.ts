/// <reference types="react" />
import { type WebViewProps } from 'react-native-webview';
import type { EditorBridge } from '../types';
interface RichTextProps extends WebViewProps {
    editor: EditorBridge;
    /** Makes it so that the onMessage method provided by Tentap does not fire if you have your own custom onMessage method.
     * Introduced for backwards compatibility with previous versions of Tentap that had this behaviour by default.
     * */
    exclusivelyUseCustomOnMessage?: boolean;
}
export declare const RichText: ({ editor, onMessage, exclusivelyUseCustomOnMessage, ...props }: RichTextProps) => JSX.Element;
export {};
//# sourceMappingURL=RichText.d.ts.map