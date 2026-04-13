"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EditLinkBar = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNative = require("react-native");
var _assets = require("../../assets");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const EditLinkBar = ({
  theme,
  initialLink,
  onEditLink,
  onLinkIconClick,
  onBlur
}) => {
  const [link, setLink] = _react.default.useState(initialLink || '');
  return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: theme.toolbar.linkBarTheme.addLinkContainer
  }, /*#__PURE__*/_react.default.createElement(_reactNative.TouchableOpacity, {
    onPress: onLinkIconClick,
    style: [theme.toolbar.toolbarButton, theme.toolbar.linkBarTheme.linkToolbarButton]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: [theme.toolbar.iconWrapper, theme.toolbar.iconWrapperActive]
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Image, {
    source: _assets.Images.link,
    style: [theme.toolbar.icon, theme.toolbar.iconActive],
    resizeMode: "contain"
  }))), /*#__PURE__*/_react.default.createElement(_reactNative.TextInput, {
    value: link,
    onBlur: onBlur,
    onChangeText: setLink,
    placeholder: "Type your URL here...",
    placeholderTextColor: theme.toolbar.linkBarTheme.placeholderTextColor,
    autoFocus: true,
    style: theme.toolbar.linkBarTheme.linkInput,
    autoCapitalize: "none"
  }), /*#__PURE__*/_react.default.createElement(_reactNative.TouchableOpacity, {
    style: theme.toolbar.linkBarTheme.doneButton,
    onPress: () => {
      onEditLink(link);
    }
  }, /*#__PURE__*/_react.default.createElement(_reactNative.Text, {
    style: theme.toolbar.linkBarTheme.doneButtonText
  }, "Insert")));
};
exports.EditLinkBar = EditLinkBar;
//# sourceMappingURL=EditLinkBar.js.map