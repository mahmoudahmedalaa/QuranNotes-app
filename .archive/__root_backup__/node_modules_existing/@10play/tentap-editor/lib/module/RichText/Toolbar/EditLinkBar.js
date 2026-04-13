import React from 'react';
import { View, TextInput, TouchableOpacity, Text, Image } from 'react-native';
import { Images } from '../../assets';
export const EditLinkBar = ({
  theme,
  initialLink,
  onEditLink,
  onLinkIconClick,
  onBlur
}) => {
  const [link, setLink] = React.useState(initialLink || '');
  return /*#__PURE__*/React.createElement(View, {
    style: theme.toolbar.linkBarTheme.addLinkContainer
  }, /*#__PURE__*/React.createElement(TouchableOpacity, {
    onPress: onLinkIconClick,
    style: [theme.toolbar.toolbarButton, theme.toolbar.linkBarTheme.linkToolbarButton]
  }, /*#__PURE__*/React.createElement(View, {
    style: [theme.toolbar.iconWrapper, theme.toolbar.iconWrapperActive]
  }, /*#__PURE__*/React.createElement(Image, {
    source: Images.link,
    style: [theme.toolbar.icon, theme.toolbar.iconActive],
    resizeMode: "contain"
  }))), /*#__PURE__*/React.createElement(TextInput, {
    value: link,
    onBlur: onBlur,
    onChangeText: setLink,
    placeholder: "Type your URL here...",
    placeholderTextColor: theme.toolbar.linkBarTheme.placeholderTextColor,
    autoFocus: true,
    style: theme.toolbar.linkBarTheme.linkInput,
    autoCapitalize: "none"
  }), /*#__PURE__*/React.createElement(TouchableOpacity, {
    style: theme.toolbar.linkBarTheme.doneButton,
    onPress: () => {
      onEditLink(link);
    }
  }, /*#__PURE__*/React.createElement(Text, {
    style: theme.toolbar.linkBarTheme.doneButtonText
  }, "Insert")));
};
//# sourceMappingURL=EditLinkBar.js.map