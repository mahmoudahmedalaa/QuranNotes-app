/// <reference types="react" />
import type { EditorBridge } from '../../types';
import type { ToolbarItem } from './actions';
interface WebToolbarProps {
    editor: EditorBridge;
    args: Parameters<ToolbarItem['onPress']>[0];
    items: ToolbarItem[];
    hidden?: boolean;
}
export declare const WebToolbar: ({ args, editor, hidden, items, }: WebToolbarProps) => JSX.Element | null;
export {};
//# sourceMappingURL=WebToolbar.d.ts.map