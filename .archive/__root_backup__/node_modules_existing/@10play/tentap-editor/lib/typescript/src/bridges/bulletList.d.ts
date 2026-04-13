import BridgeExtension from './base';
type BulletListEditorState = {
    isBulletListActive: boolean;
    canToggleBulletList: boolean;
};
type BulletListEditorInstance = {
    toggleBulletList: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends BulletListEditorState {
    }
    interface EditorBridge extends BulletListEditorInstance {
    }
}
export declare enum BulletListEditorActionType {
    ToggleBulletList = "toggle-bulletList"
}
type BulletListMessage = {
    type: BulletListEditorActionType.ToggleBulletList;
    payload?: undefined;
};
export declare const BulletListBridge: BridgeExtension<BulletListEditorState, BulletListEditorInstance, BulletListMessage>;
export {};
//# sourceMappingURL=bulletList.d.ts.map