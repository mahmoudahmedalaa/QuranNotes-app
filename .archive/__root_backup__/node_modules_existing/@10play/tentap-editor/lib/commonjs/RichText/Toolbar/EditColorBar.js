"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EditColorBar = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNative = require("react-native");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const toolbarStyles = _reactNative.StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row'
  }
});
const EditColorBar = ({
  onFinish
}) => {
  return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: toolbarStyles.container
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Button, {
    title: "DONE",
    onPress: onFinish
  }));
};
exports.EditColorBar = EditColorBar;
//# sourceMappingURL=EditColorBar.js.map