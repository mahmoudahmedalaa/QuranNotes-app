import BridgeExtension from './base';
type HardBreakState = {};
type HardBreakEditorInstance = {
    setHardBreak: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends HardBreakState {
    }
    interface EditorBridge extends HardBreakEditorInstance {
    }
}
export declare enum HardBreakEditorActionType {
    setHardBreak = "set-hard-break"
}
type HardBreakMessage = {
    type: HardBreakEditorActionType.setHardBreak;
    payload?: undefined;
};
export declare const HardBreakBridge: BridgeExtension<HardBreakState, HardBreakEditorInstance, HardBreakMessage>;
export {};
//# sourceMappingURL=br.d.ts.map