import BridgeExtension from './base';
type ListItemEditorState = {
    canLift: boolean;
    canSink: boolean;
};
type ListItemEditorInstance = {
    lift: () => void;
    sink: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends ListItemEditorState {
    }
    interface EditorBridge extends ListItemEditorInstance {
    }
}
export declare enum ListItemEditorActionType {
    Lift = "lift",
    Sink = "sink"
}
type ToggleActionTypes = ListItemEditorActionType.Lift | ListItemEditorActionType.Sink;
export interface ListItemMessage {
    type: ToggleActionTypes;
    payload?: undefined;
}
export declare const ListItemBridge: BridgeExtension<ListItemEditorState, ListItemEditorInstance, ListItemMessage>;
export {};
