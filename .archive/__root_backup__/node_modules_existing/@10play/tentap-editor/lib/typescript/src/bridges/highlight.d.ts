import BridgeExtension from './base';
type HighlightEditorState = {
    activeHighlight: string | undefined;
};
type HighlightEditorInstance = {
    setHighlight: (color: string) => void;
    toggleHighlight: (color: string) => void;
    unsetHighlight: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends HighlightEditorState {
    }
    interface EditorBridge extends HighlightEditorInstance {
    }
}
export declare enum HighlightEditorActionType {
    SetHighlight = "set-highlight",
    ToggleHighlight = "toggle-highlight",
    UnsetHighlight = "unset-highlight"
}
type SetHighlightMessage = {
    type: HighlightEditorActionType.SetHighlight;
    payload: string;
};
type ToggleHighlightMessage = {
    type: HighlightEditorActionType.ToggleHighlight;
    payload: string;
};
type UnsetHighlightMessage = {
    type: HighlightEditorActionType.UnsetHighlight;
    payload: undefined;
};
type HighlightMessage = SetHighlightMessage | ToggleHighlightMessage | UnsetHighlightMessage;
export declare const HighlightBridge: BridgeExtension<HighlightEditorState, HighlightEditorInstance, HighlightMessage>;
export {};
//# sourceMappingURL=highlight.d.ts.map