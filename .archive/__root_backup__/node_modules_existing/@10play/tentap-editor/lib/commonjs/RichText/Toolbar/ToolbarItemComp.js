"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ToolbarItemComp = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNative = require("react-native");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const ToolbarItemComp = ({
  onPress,
  disabled,
  active,
  image,
  editor,
  args
}) => {
  return /*#__PURE__*/_react.default.createElement(_reactNative.TouchableOpacity, {
    onPress: onPress(args),
    disabled: disabled(args),
    style: [editor.theme.toolbar.toolbarButton]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: [editor.theme.toolbar.iconWrapper, active(args) ? editor.theme.toolbar.iconWrapperActive : undefined, disabled(args) ? editor.theme.toolbar.iconWrapperDisabled : undefined]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Image, {
    source: image(args),
    style: [editor.theme.toolbar.icon, active(args) ? editor.theme.toolbar.iconActive : undefined, disabled(args) ? editor.theme.toolbar.iconDisabled : undefined],
    resizeMode: "contain"
  })));
};
exports.ToolbarItemComp = ToolbarItemComp;
//# sourceMappingURL=ToolbarItemComp.js.map