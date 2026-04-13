"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useKeyboard = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
const hideEvent = _reactNative.Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
const useKeyboard = () => {
  const [isKeyboardUp, setIsKeyboardUp] = _react.default.useState(false);
  const [keyboardHeight, setKeyboardHeight] = _react.default.useState(0);
  (0, _react.useEffect)(() => {
    const willShowSubscription = _reactNative.Keyboard.addListener('keyboardWillShow', () => {
      setIsKeyboardUp(true);
    });
    const didShowSubscription = _reactNative.Keyboard.addListener('keyboardDidShow', e => {
      setIsKeyboardUp(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = _reactNative.Keyboard.addListener(hideEvent, () => {
      setIsKeyboardUp(false);
      setKeyboardHeight(0);
    });
    return () => {
      willShowSubscription.remove();
      didShowSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  return {
    isKeyboardUp,
    keyboardHeight
  };
};
exports.useKeyboard = useKeyboard;
//# sourceMappingURL=useKeyboard.js.map