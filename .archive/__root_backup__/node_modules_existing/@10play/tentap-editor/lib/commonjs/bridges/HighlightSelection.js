"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.blueBackgroundPlugin = void 0;
var _state = require("@tiptap/pm/state");
var _view = require("@tiptap/pm/view");
var _react = require("@tiptap/react");
const blueBackgroundPlugin = exports.blueBackgroundPlugin = _react.Extension.create({
  name: 'eventHandler',
  addProseMirrorPlugins() {
    return [new _state.Plugin({
      key: new _state.PluginKey('blueBackground'),
      state: {
        init() {
          return _view.DecorationSet.empty;
        },
        apply(tr, _oldState, _oldEditorState, newEditorState) {
          if (tr.selection.empty) {
            // If there is no selection, return the old state
            return _view.DecorationSet.empty;
          } else {
            // If there is a selection, create a decoration
            const decorations = [];
            const {
              from,
              to
            } = tr.selection;
            decorations.push(_view.Decoration.inline(from, to, {
              class: 'highlight-background'
            }));
            return _view.DecorationSet.create(newEditorState.doc, decorations);
          }
        }
      },
      props: {
        decorations(state) {
          return this.getState(state);
        }
      }
    })];
  }
});
//# sourceMappingURL=HighlightSelection.js.map