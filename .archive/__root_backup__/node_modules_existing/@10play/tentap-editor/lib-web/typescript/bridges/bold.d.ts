import BridgeExtension from './base';
type BoldEditorState = {
    isBoldActive: boolean;
    canToggleBold: boolean;
};
type BoldEditorInstance = {
    toggleBold: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends BoldEditorState {
    }
    interface EditorBridge extends BoldEditorInstance {
    }
}
export declare enum BoldEditorActionType {
    ToggleBold = "toggle-bold"
}
type BoldMessage = {
    type: BoldEditorActionType.ToggleBold;
    payload?: undefined;
};
export declare const BoldBridge: BridgeExtension<BoldEditorState, BoldEditorInstance, BoldMessage>;
export {};
