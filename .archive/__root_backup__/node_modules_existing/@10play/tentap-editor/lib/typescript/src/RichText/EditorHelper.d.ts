import type { EditorBridge } from '../types';
import type { Subscription } from '../types/Subscription';
declare class _EditorHelper {
    editorLastInstance: EditorBridge | undefined;
    cbs: ((editor: EditorBridge | undefined) => void)[];
    constructor();
    setEditorLastInstance(editorLastInstance: EditorBridge): void;
    subscribe: Subscription<EditorBridge | undefined>;
}
export declare const EditorHelper: _EditorHelper;
export declare const useRemoteEditorBridge: () => EditorBridge | undefined;
export {};
//# sourceMappingURL=EditorHelper.d.ts.map