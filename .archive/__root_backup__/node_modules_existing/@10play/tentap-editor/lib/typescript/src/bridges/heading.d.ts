import { type Level } from '@tiptap/extension-heading';
import BridgeExtension from './base';
type HeadingEditorState = {
    headingLevel: number | undefined;
    canToggleHeading: boolean;
};
type HeadingEditorInstance = {
    toggleHeading: (level: Level) => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends HeadingEditorState {
    }
    interface EditorBridge extends HeadingEditorInstance {
    }
}
export declare enum HeadingEditorActionType {
    ToggleHeading = "toggle-heading"
}
type HeadingMessage = {
    type: HeadingEditorActionType.ToggleHeading;
    payload: Level;
};
export declare const HeadingBridge: BridgeExtension<HeadingEditorState, HeadingEditorInstance, HeadingMessage>;
export {};
//# sourceMappingURL=heading.d.ts.map