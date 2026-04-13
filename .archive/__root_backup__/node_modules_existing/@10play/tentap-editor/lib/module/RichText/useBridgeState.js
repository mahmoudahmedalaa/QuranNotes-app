import { useEffect, useState } from 'react';
export const useBridgeState = editor => {
  const [editorState, setEditorState] = useState(editor.getEditorState());
  useEffect(() => {
    const unsubscribe = editor._subscribeToEditorStateUpdate(setEditorState);
    return unsubscribe;
  }, [editor]);
  return editorState;
};
//# sourceMappingURL=useBridgeState.js.map