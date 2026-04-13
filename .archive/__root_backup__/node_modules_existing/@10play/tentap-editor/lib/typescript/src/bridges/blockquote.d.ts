import BridgeExtension from './base';
type BlockquoteEditorState = {
    isBlockquoteActive: boolean;
    canToggleBlockquote: boolean;
};
type BlockquoteEditorInstance = {
    toggleBlockquote: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends BlockquoteEditorState {
    }
    interface EditorBridge extends BlockquoteEditorInstance {
    }
}
export declare enum BlockquoteEditorActionType {
    ToggleBlockquote = "toggle-blockquote"
}
type BlockquoteMessage = {
    type: BlockquoteEditorActionType.ToggleBlockquote;
    payload?: undefined;
};
export declare const BlockquoteBridge: BridgeExtension<BlockquoteEditorState, BlockquoteEditorInstance, BlockquoteMessage>;
export {};
//# sourceMappingURL=blockquote.d.ts.map