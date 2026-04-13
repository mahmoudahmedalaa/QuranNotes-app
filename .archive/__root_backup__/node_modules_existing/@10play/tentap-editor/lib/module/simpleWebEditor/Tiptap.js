import React from 'react';
import { EditorContent } from '@tiptap/react';
import { useTenTap } from '../webEditorUtils';
import { TenTapStartKit } from '../bridges/StarterKit';
let tenTapExtensions = TenTapStartKit.filter(e => !window.whiteListBridgeExtensions || window.whiteListBridgeExtensions.includes(e.name));
export default function Tiptap() {
  const editor = useTenTap({
    bridges: tenTapExtensions
  });
  return /*#__PURE__*/React.createElement(EditorContent, {
    editor: editor,
    className: window.dynamicHeight ? 'dynamic-height' : undefined
  });
}
//# sourceMappingURL=Tiptap.js.map