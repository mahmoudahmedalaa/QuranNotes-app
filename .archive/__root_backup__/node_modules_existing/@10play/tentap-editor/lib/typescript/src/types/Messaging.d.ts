import type { CoreMessages } from '../bridges/core';
export declare enum EditorMessageType {
    Action = "action"
}
export interface EditorActionMessage {
    type: EditorMessageType.Action;
    payload: any;
    id?: string;
}
export type EditorMessage = EditorActionMessage | CoreMessages;
//# sourceMappingURL=Messaging.d.ts.map