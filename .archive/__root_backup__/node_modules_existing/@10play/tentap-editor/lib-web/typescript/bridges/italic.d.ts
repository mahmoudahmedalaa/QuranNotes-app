import BridgeExtension from './base';
type ItalicEditorState = {
    isItalicActive: boolean;
    canToggleItalic: boolean;
};
type ItalicEditorInstance = {
    toggleItalic: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends ItalicEditorState {
    }
    interface EditorBridge extends ItalicEditorInstance {
    }
}
export declare enum ItalicEditorActionType {
    ToggleItalic = "toggle-italic"
}
type ItalicMessage = {
    type: ItalicEditorActionType.ToggleItalic;
    payload?: undefined;
};
export declare const ItalicBridge: BridgeExtension<ItalicEditorState, ItalicEditorInstance, ItalicMessage>;
export {};
