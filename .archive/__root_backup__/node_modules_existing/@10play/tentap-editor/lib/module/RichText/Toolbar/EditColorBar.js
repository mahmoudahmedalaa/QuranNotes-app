import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
const toolbarStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row'
  }
});
export const EditColorBar = ({
  onFinish
}) => {
  return /*#__PURE__*/React.createElement(View, {
    style: toolbarStyles.container
  }, /*#__PURE__*/React.createElement(Button, {
    title: "DONE",
    onPress: onFinish
  }));
};
//# sourceMappingURL=EditColorBar.js.map