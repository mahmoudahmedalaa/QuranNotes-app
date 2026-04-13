import BridgeExtension from './base';
type HistoryEditorState = {
    canUndo: boolean;
    canRedo: boolean;
};
type HistoryEditorInstance = {
    undo: () => void;
    redo: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends HistoryEditorState {
    }
    interface EditorBridge extends HistoryEditorInstance {
    }
}
export declare enum HistoryEditorActionType {
    Undo = "undo",
    Redo = "redo"
}
type HistoryMessage = {
    type: HistoryEditorActionType.Undo | HistoryEditorActionType.Redo;
    payload?: undefined;
};
export declare const HistoryBridge: BridgeExtension<HistoryEditorState, HistoryEditorInstance, HistoryMessage>;
export {};
