import { darkToolbarTheme, defaultToolbarTheme } from './Toolbar/toolbarTheme';
export const defaultEditorTheme = {
  toolbar: defaultToolbarTheme,
  webview: {
    backgroundColor: 'white'
  },
  webviewContainer: {}
};
const DARK_EDITOR_BACKGROUND_COLOR = '#1C1C1E';
export const darkEditorTheme = {
  toolbar: darkToolbarTheme,
  webview: {
    backgroundColor: DARK_EDITOR_BACKGROUND_COLOR
  },
  webviewContainer: {}
};
export const darkEditorCss = `
  * {
    background-color: ${DARK_EDITOR_BACKGROUND_COLOR};
    color: white;
  }
  blockquote {
    border-left: 3px solid #babaca;
    padding-left: 1rem;
  }
  .highlight-background {
    background-color: #474749;
  }
`;
//# sourceMappingURL=theme.js.map