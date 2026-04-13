import React from 'react';
import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
export const useKeyboard = () => {
  const [isKeyboardUp, setIsKeyboardUp] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  useEffect(() => {
    const willShowSubscription = Keyboard.addListener('keyboardWillShow', () => {
      setIsKeyboardUp(true);
    });
    const didShowSubscription = Keyboard.addListener('keyboardDidShow', e => {
      setIsKeyboardUp(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
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
//# sourceMappingURL=useKeyboard.js.map