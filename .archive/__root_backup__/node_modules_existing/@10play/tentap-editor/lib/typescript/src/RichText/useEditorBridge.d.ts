import type { EditorBridge, EditorTheme } from '../types';
import type BridgeExtension from '../bridges/base';
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};
export declare const useEditorBridge: (options?: {
    bridgeExtensions?: BridgeExtension<any, any, any>[];
    initialContent?: string | object;
    autofocus?: boolean;
    avoidIosKeyboard?: boolean;
    customSource?: string;
    webviewBaseURL?: string;
    dynamicHeight?: boolean;
    disableColorHighlight?: boolean;
    editable?: boolean;
    onChange?: () => void;
    DEV?: boolean;
    DEV_SERVER_URL?: string;
    theme?: RecursivePartial<EditorTheme>;
}) => EditorBridge;
//# sourceMappingURL=useEditorBridge.d.ts.map