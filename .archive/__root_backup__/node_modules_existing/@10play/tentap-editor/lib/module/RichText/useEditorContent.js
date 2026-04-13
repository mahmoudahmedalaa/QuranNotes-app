import debounce from 'lodash/debounce';
import { useEffect, useState } from 'react';
const DEFAULT_OPTIONS = {
  type: 'html',
  debounceInterval: 10
};
export function useEditorContent(editor, {
  debounceInterval,
  type
} = DEFAULT_OPTIONS) {
  const [content, setContent] = useState();
  useEffect(() => {
    const updateContent = debounce(async () => {
      switch (type) {
        case 'json':
          const json = await editor.getJSON();
          setContent(json);
          break;
        case 'text':
          const text = await editor.getText();
          setContent(text);
          break;
        case 'html':
        default:
          const html = await editor.getHTML();
          setContent(html);
          break;
      }
    }, debounceInterval);
    const unsubscribe = editor._subscribeToEditorStateUpdate(() => {
      updateContent();
    });
    return () => {
      unsubscribe();
    };
  }, [editor, debounceInterval, type]);
  return content;
}
//# sourceMappingURL=useEditorContent.js.map