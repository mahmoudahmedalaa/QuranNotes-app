/// <reference types="react" />
import type { ToolbarItem } from './actions';
import type { EditorBridge } from '../../types';
export declare const ToolbarItemComp: ({ onPress, disabled, active, image, editor, args, }: ToolbarItem & {
    editor: EditorBridge;
    args: Parameters<ToolbarItem['onPress']>[0];
}) => JSX.Element;
//# sourceMappingURL=ToolbarItemComp.d.ts.map