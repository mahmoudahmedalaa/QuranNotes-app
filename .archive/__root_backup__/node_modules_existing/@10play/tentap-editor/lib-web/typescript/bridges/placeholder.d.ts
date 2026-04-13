import BridgeExtension from './base';
type PlaceholderEditorState = {};
type PlaceholderEditorInstance = {
    setPlaceholder: (newPlaceholder: string) => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends PlaceholderEditorState {
    }
    interface EditorBridge extends PlaceholderEditorInstance {
    }
}
export declare enum PlaceholderEditorActionType {
    setPlaceholder = "set-placeholder"
}
export interface PlaceholderMessage {
    type: PlaceholderEditorActionType.setPlaceholder;
    payload: string;
}
export declare const PlaceholderBridge: BridgeExtension<PlaceholderEditorState, PlaceholderEditorInstance, PlaceholderMessage>;
export {};
