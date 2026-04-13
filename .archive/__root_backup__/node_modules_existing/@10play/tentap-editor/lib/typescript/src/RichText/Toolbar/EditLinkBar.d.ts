/// <reference types="react" />
import type { EditorTheme } from '../../types';
interface EditLinkBarProps {
    theme: EditorTheme;
    onBlur: () => void;
    onEditLink: (newLink: string) => void;
    onLinkIconClick: () => void;
    initialLink: string | undefined;
}
export declare const EditLinkBar: ({ theme, initialLink, onEditLink, onLinkIconClick, onBlur, }: EditLinkBarProps) => JSX.Element;
export {};
//# sourceMappingURL=EditLinkBar.d.ts.map