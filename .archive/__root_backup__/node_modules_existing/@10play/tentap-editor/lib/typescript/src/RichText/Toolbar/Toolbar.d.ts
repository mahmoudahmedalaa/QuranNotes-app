/// <reference types="react" />
import { type ToolbarItem } from './actions';
import type { EditorBridge } from '../../types';
interface ToolbarProps {
    editor: EditorBridge;
    hidden?: boolean;
    items?: ToolbarItem[];
    shouldHideDisabledToolbarItems?: boolean;
}
export declare const toolbarStyles: {};
export declare function Toolbar({ editor, hidden, items, shouldHideDisabledToolbarItems, }: ToolbarProps): JSX.Element;
export {};
//# sourceMappingURL=Toolbar.d.ts.map