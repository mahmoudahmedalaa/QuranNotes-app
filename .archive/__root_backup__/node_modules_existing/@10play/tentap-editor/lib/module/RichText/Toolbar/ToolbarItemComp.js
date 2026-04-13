import React from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
export const ToolbarItemComp = ({
  onPress,
  disabled,
  active,
  image,
  editor,
  args
}) => {
  return /*#__PURE__*/React.createElement(TouchableOpacity, {
    onPress: onPress(args),
    disabled: disabled(args),
    style: [editor.theme.toolbar.toolbarButton]
  }, /*#__PURE__*/React.createElement(View, {
    style: [editor.theme.toolbar.iconWrapper, active(args) ? editor.theme.toolbar.iconWrapperActive : undefined, disabled(args) ? editor.theme.toolbar.iconWrapperDisabled : undefined]
  }, /*#__PURE__*/React.createElement(Image, {
    source: image(args),
    style: [editor.theme.toolbar.icon, active(args) ? editor.theme.toolbar.iconActive : undefined, disabled(args) ? editor.theme.toolbar.iconDisabled : undefined],
    resizeMode: "contain"
  })));
};
//# sourceMappingURL=ToolbarItemComp.js.map