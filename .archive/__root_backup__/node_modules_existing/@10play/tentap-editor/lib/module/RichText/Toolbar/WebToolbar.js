function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
import React from 'react';
import { View } from 'react-native';
import { ToolbarItemComp } from './ToolbarItemComp';
export const WebToolbar = ({
  args,
  editor,
  hidden,
  items
}) => {
  if (hidden) return null;
  return /*#__PURE__*/React.createElement(View, {
    style: {
      flexDirection: 'row'
    }
  }, items === null || items === void 0 ? void 0 : items.map((item, i) => /*#__PURE__*/React.createElement(ToolbarItemComp, _extends({}, item, {
    args: args,
    editor: editor,
    key: i
  }))));
};
//# sourceMappingURL=WebToolbar.js.map