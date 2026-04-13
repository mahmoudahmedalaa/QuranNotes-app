import type { EditorBridge } from '../types';
import type { EditorContentType } from '../bridges/core';
interface Options<T extends EditorContentType> {
    type?: T;
    debounceInterval?: number;
}
type ContentType<T extends EditorContentType> = T extends 'json' ? object : string;
export declare function useEditorContent<T extends EditorContentType>(editor: EditorBridge, { debounceInterval, type }?: Options<T>): ContentType<T> | undefined;
export {};
//# sourceMappingURL=useEditorContent.d.ts.map