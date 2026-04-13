import BridgeExtension from './base';
type ColorEditorState = {
    activeColor: string | undefined;
};
type ColorEditorInstance = {
    setColor: (color: string) => void;
    unsetColor: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends ColorEditorState {
    }
    interface EditorBridge extends ColorEditorInstance {
    }
}
export declare enum ColorEditorActionType {
    SetColor = "set-color",
    UnsetColor = "unset-color"
}
type SetColorMessage = {
    type: ColorEditorActionType.SetColor;
    payload: string;
};
type UnsetColorMessage = {
    type: ColorEditorActionType.UnsetColor;
    payload: undefined;
};
type ColorMessage = SetColorMessage | UnsetColorMessage;
export declare const ColorBridge: BridgeExtension<ColorEditorState, ColorEditorInstance, ColorMessage>;
export {};
