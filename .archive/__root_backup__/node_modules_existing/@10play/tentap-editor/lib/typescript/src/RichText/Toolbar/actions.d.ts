import { EditorActionType } from '../../types/Actions';
import type { EditorBridge } from '../../types';
import { type BridgeState } from '../../types/EditorBridge';
export declare enum ToolbarContext {
    Main = 0,
    Link = 1,
    Heading = 2
}
export declare const ToolbarItems: {
    readonly ToggleH1: "toggle-h1";
    readonly ToggleH2: "toggle-h2";
    readonly ToggleH3: "toggle-h3";
    readonly ToggleH4: "toggle-h4";
    readonly ToggleH5: "toggle-h5";
    readonly ToggleH6: "toggle-h6";
    readonly ChangeHighlight: EditorActionType.ChangeHighlight;
    readonly ChangeColor: EditorActionType.ChangeColor;
    readonly Link: EditorActionType.Link;
    readonly ToggleUnderline: EditorActionType.ToggleUnderline;
    readonly SetHardBreak: EditorActionType.SetHardBreak;
};
type ArgsToolbarCB = {
    editor: EditorBridge;
    editorState: BridgeState;
    setToolbarContext: (ToolbarContext: ToolbarContext | ((prev: ToolbarContext) => ToolbarContext)) => void;
    toolbarContext: ToolbarContext;
};
export interface ToolbarItem {
    onPress: ({ editor, editorState }: ArgsToolbarCB) => () => void;
    active: ({ editor, editorState }: ArgsToolbarCB) => boolean;
    disabled: ({ editor, editorState }: ArgsToolbarCB) => boolean;
    image: ({ editor, editorState }: ArgsToolbarCB) => any;
}
export declare const DEFAULT_TOOLBAR_ITEMS: ToolbarItem[];
export declare const HEADING_ITEMS: ToolbarItem[];
export {};
//# sourceMappingURL=actions.d.ts.map