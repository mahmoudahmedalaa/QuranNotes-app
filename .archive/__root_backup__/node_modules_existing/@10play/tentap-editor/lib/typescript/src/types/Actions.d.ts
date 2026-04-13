export declare enum EditorActionType {
    ChangeHighlight = "change-highlight",
    ChangeColor = "change-color",
    Link = "link",
    ToggleUnderline = "toggle-underline",
    SetHardBreak = "set-hard-break"
}
type RegularActions = EditorActionType.ChangeHighlight | EditorActionType.ChangeColor | EditorActionType.Link | EditorActionType.ToggleUnderline | EditorActionType.SetHardBreak;
export interface RegularAction {
    type: RegularActions;
    payload?: any;
}
export declare enum EditorUpdateSettings {
    Focus = "focus"
}
export {};
//# sourceMappingURL=Actions.d.ts.map