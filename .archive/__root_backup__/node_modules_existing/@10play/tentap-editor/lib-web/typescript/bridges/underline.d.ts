import BridgeExtension from './base';
type UnderlineEditorState = {
    isUnderlineActive: boolean;
    canToggleUnderline: boolean;
};
type UnderlineEditorInstance = {
    toggleUnderline: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends UnderlineEditorState {
    }
    interface EditorBridge extends UnderlineEditorInstance {
    }
}
export declare enum UnderlineEditorActionType {
    ToggleUnderline = "toggle-underline"
}
type UnderlineMessage = {
    type: UnderlineEditorActionType.ToggleUnderline;
    payload?: undefined;
};
export declare const UnderlineBridge: BridgeExtension<UnderlineEditorState, UnderlineEditorInstance, UnderlineMessage>;
export {};
