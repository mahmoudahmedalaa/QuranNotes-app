"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultEditorTheme = exports.darkEditorTheme = exports.darkEditorCss = void 0;
var _toolbarTheme = require("./Toolbar/toolbarTheme");
const defaultEditorTheme = exports.defaultEditorTheme = {
  toolbar: _toolbarTheme.defaultToolbarTheme,
  webview: {
    backgroundColor: 'white'
  },
  webviewContainer: {}
};
const DARK_EDITOR_BACKGROUND_COLOR = '#1C1C1E';
const darkEditorTheme = exports.darkEditorTheme = {
  toolbar: _toolbarTheme.darkToolbarTheme,
  webview: {
    backgroundColor: DARK_EDITOR_BACKGROUND_COLOR
  },
  webviewContainer: {}
};
const darkEditorCss = exports.darkEditorCss = `
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