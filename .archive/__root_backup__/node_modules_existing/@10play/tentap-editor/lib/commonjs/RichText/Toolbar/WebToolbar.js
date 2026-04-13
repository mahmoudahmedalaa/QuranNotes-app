"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebToolbar = void 0;
var _react = _interopRequireDefault(require("react"));
var _reactNative = require("react-native");
var _ToolbarItemComp = require("./ToolbarItemComp");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
const WebToolbar = ({
  args,
  editor,
  hidden,
  items
}) => {
  if (hidden) return null;
  return /*#__PURE__*/_react.default.createElement(_reactNative.View, {
    style: {
      flexDirection: 'row'
    }
  }, items === null || items === void 0 ? void 0 : items.map((item, i) => /*#__PURE__*/_react.default.createElement(_ToolbarItemComp.ToolbarItemComp, _extends({}, item, {
    args: args,
    editor: editor,
    key: i
  }))));
};
exports.WebToolbar = WebToolbar;
//# sourceMappingURL=WebToolbar.js.map