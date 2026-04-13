import BridgeExtension from './base';
type LinkEditorState = {
    isLinkActive: boolean;
    canSetLink: boolean;
    activeLink: string | undefined;
};
type LinkEditorInstance = {
    setLink: (link: string | null) => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends LinkEditorState {
    }
    interface EditorBridge extends LinkEditorInstance {
    }
}
export declare enum LinkEditorActionType {
    SetLink = "set-link"
}
type LinkMessage = {
    type: LinkEditorActionType.SetLink;
    payload: null | string;
};
export declare const LinkBridge: BridgeExtension<LinkEditorState, LinkEditorInstance, LinkMessage>;
export {};
//# sourceMappingURL=link.d.ts.map