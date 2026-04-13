import BridgeExtension from './base';
type StrikeEditorState = {
    isStrikeActive: boolean;
    canToggleStrike: boolean;
};
type StrikeEditorInstance = {
    toggleStrike: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends StrikeEditorState {
    }
    interface EditorBridge extends StrikeEditorInstance {
    }
}
export declare enum StrikeEditorActionType {
    ToggleStrike = "toggle-strike"
}
type StrikeMessage = {
    type: StrikeEditorActionType.ToggleStrike;
    payload?: undefined;
};
export declare const StrikeBridge: BridgeExtension<StrikeEditorState, StrikeEditorInstance, StrikeMessage>;
export {};
//# sourceMappingURL=strike.d.ts.map