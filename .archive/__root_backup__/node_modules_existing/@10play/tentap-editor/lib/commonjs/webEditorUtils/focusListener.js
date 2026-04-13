"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.focusListener = void 0;
var _misc = require("../utils/misc");
class FocusListener {
  constructor() {
    this.focus = false;
    // @ts-ignore
    window.document.addEventListener('focus', () => {
      this.focus = true;
    }, true);
    // @ts-ignore
    window.document.addEventListener('blur', () => {
      this.focus = false;
    }, true);
  }
  get isFocused() {
    return this.focus;
  }
}

// For some reason on expo, this file is parsed on native, and then we get an error
// when bundling because "document" does not exist. This is a hack to "shim" focusListener on expo
const shimmedFocusListener = {
  isFocused: false
};
const focusListener = exports.focusListener = (0, _misc.isExpo)() ? shimmedFocusListener : new FocusListener();
//# sourceMappingURL=focusListener.js.map