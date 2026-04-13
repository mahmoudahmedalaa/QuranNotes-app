import BridgeExtension from './base';
type OrderedListEditorState = {
    isOrderedListActive: boolean;
    canToggleOrderedList: boolean;
};
type OrderedListEditorInstance = {
    toggleOrderedList: () => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends OrderedListEditorState {
    }
    interface EditorBridge extends OrderedListEditorInstance {
    }
}
export declare enum OrderedListEditorActionType {
    ToggleOrderedList = "toggle-orderedList"
}
type OrderedListMessage = {
    type: OrderedListEditorActionType.ToggleOrderedList;
    payload?: undefined;
};
export declare const OrderedListBridge: BridgeExtension<OrderedListEditorState, OrderedListEditorInstance, OrderedListMessage>;
export {};
//# sourceMappingURL=orderedList.d.ts.map