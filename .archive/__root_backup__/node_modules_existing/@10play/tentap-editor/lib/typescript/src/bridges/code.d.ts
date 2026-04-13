import BridgeExtension from './base';
type CodeEditorState = {
    isCodeActive: boolean;
    canToggleCode: boolean;
};
type CodeEditorInstance = {
    toggleCode: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends CodeEditorState {
    }
    interface EditorBridge extends CodeEditorInstance {
    }
}
export declare enum CodeEditorActionType {
    ToggleCode = "toggle-code"
}
type CodeMessage = {
    type: CodeEditorActionType.ToggleCode;
    payload?: undefined;
};
export declare const CodeBridge: BridgeExtension<CodeEditorState, CodeEditorInstance, CodeMessage>;
export {};
//# sourceMappingURL=code.d.ts.map