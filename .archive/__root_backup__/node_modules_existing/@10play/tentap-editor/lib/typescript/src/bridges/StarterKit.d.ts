export declare const TenTapStartKit: (import("./base").default<{
    selection: {
        from: number;
        to: number;
    };
    isFocused: boolean;
    isReady: boolean;
    editable: boolean;
    empty: boolean;
}, Omit<{
    getHTML: () => Promise<string>;
    getJSON: () => Promise<object>;
    getText: () => Promise<string>;
    setContent: (content: import("@tiptap/core").Content) => void;
    setSelection: (from: number, to: number) => void;
    updateScrollThresholdAndMargin: (offset: number) => void;
    focus: (pos: number | boolean | "start" | "end" | "all" | null) => void;
    blur: () => void;
    injectJS: (js: string) => void;
    injectCSS: (css: string, tag?: string | undefined) => void;
    setEditable: (editable: boolean) => void;
    theme: import("..").EditorTheme;
}, "theme" | "injectCSS">, import("./core").CoreMessages> | import("./base").default<any, any, any> | import("./base").default<{
    isBoldActive: boolean;
    canToggleBold: boolean;
}, {
    toggleBold: () => void;
}, {
    type: import("./bold").BoldEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isCodeActive: boolean;
    canToggleCode: boolean;
}, {
    toggleCode: () => void;
}, {
    type: import("./code").CodeEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isItalicActive: boolean;
    canToggleItalic: boolean;
}, {
    toggleItalic: () => void;
}, {
    type: import("./italic").ItalicEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    canUndo: boolean;
    canRedo: boolean;
}, {
    undo: () => void;
    redo: () => void;
}, {
    type: import("./history").HistoryEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isStrikeActive: boolean;
    canToggleStrike: boolean;
}, {
    toggleStrike: () => void;
}, {
    type: import("./strike").StrikeEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isOrderedListActive: boolean;
    canToggleOrderedList: boolean;
}, {
    toggleOrderedList: () => void;
}, {
    type: import("./orderedList").OrderedListEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    headingLevel: number | undefined;
    canToggleHeading: boolean;
}, {
    toggleHeading: (level: import("@tiptap/extension-heading").Level) => void;
}, {
    type: import("./heading").HeadingEditorActionType;
    payload: import("@tiptap/extension-heading").Level;
}> | import("./base").default<{
    canLift: boolean;
    canSink: boolean;
}, {
    lift: () => void;
    sink: () => void;
}, import("./listItem").ListItemMessage> | import("./base").default<{
    isBulletListActive: boolean;
    canToggleBulletList: boolean;
}, {
    toggleBulletList: () => void;
}, {
    type: import("./bulletList").BulletListEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isBlockquoteActive: boolean;
    canToggleBlockquote: boolean;
}, {
    toggleBlockquote: () => void;
}, {
    type: import("./blockquote").BlockquoteEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isUnderlineActive: boolean;
    canToggleUnderline: boolean;
}, {
    toggleUnderline: () => void;
}, {
    type: import("./underline").UnderlineEditorActionType;
    payload?: undefined;
}> | import("./base").default<{
    isTaskListActive: boolean;
    canToggleTaskList: boolean;
    canLiftTaskListItem: boolean;
    canSinkTaskListItem: boolean;
}, {
    toggleTaskList: () => void;
    liftTaskListItem: () => void;
    sinkTaskListItem: () => void;
}, {
    type: import("./tasklist").TaskListEditorActionType.ToggleTaskList;
    payload?: undefined;
} | {
    type: import("./tasklist").TaskListEditorActionType.LiftTaskListItem;
    payload?: undefined;
} | {
    type: import("./tasklist").TaskListEditorActionType.SinkTaskListItem;
    payload?: undefined;
}> | import("./base").default<{
    isLinkActive: boolean;
    canSetLink: boolean;
    activeLink: string | undefined;
}, {
    setLink: (link: string | null) => void;
}, {
    type: import("./link").LinkEditorActionType;
    payload: string | null;
}> | import("./base").default<{
    activeColor: string | undefined;
}, {
    setColor: (color: string) => void;
    unsetColor: () => void;
}, {
    type: import("./color").ColorEditorActionType.SetColor;
    payload: string;
} | {
    type: import("./color").ColorEditorActionType.UnsetColor;
    payload: undefined;
}> | import("./base").default<{
    activeHighlight: string | undefined;
}, {
    setHighlight: (color: string) => void;
    toggleHighlight: (color: string) => void;
    unsetHighlight: () => void;
}, {
    type: import("./highlight").HighlightEditorActionType.SetHighlight;
    payload: string;
} | {
    type: import("./highlight").HighlightEditorActionType.ToggleHighlight;
    payload: string;
} | {
    type: import("./highlight").HighlightEditorActionType.UnsetHighlight;
    payload: undefined;
}> | import("./base").default<{}, {
    setImage: (src: string) => void;
}, {
    type: import("./image").ImageEditorActionType;
    payload: string;
}> | import("./base").default<{}, {
    setPlaceholder: (newPlaceholder: string) => void;
}, import("./placeholder").PlaceholderMessage> | import("./base").default<{}, {
    setHardBreak: () => void;
}, {
    type: import("./br").HardBreakEditorActionType;
    payload?: undefined;
}>)[];
//# sourceMappingURL=StarterKit.d.ts.map