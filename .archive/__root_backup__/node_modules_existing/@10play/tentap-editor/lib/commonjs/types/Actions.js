"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EditorUpdateSettings = exports.EditorActionType = void 0;
let EditorActionType = exports.EditorActionType = /*#__PURE__*/function (EditorActionType) {
  EditorActionType["ChangeHighlight"] = "change-highlight";
  EditorActionType["ChangeColor"] = "change-color";
  EditorActionType["Link"] = "link";
  EditorActionType["ToggleUnderline"] = "toggle-underline";
  EditorActionType["SetHardBreak"] = "set-hard-break";
  return EditorActionType;
}({}); // start
// Actions with no payload
let EditorUpdateSettings = exports.EditorUpdateSettings = /*#__PURE__*/function (EditorUpdateSettings) {
  EditorUpdateSettings["Focus"] = "focus";
  return EditorUpdateSettings;
}({});
//# sourceMappingURL=Actions.js.map