//@ts-ignore
export const isFabric = () => {
  var _global;
  return !!((_global = global) !== null && _global !== void 0 && _global.nativeFabricUIManager);
};
export const isExpo = () => {
  let isRunningOnExpo = false;

  // Attempt to require the Expo Constants module
  try {
    const ExpoConstants = require('expo-constants');
    if (ExpoConstants) {
      isRunningOnExpo = true;
    }
  } catch (e) {
    // If the require call throws an error, we're not in an Expo environment
    isRunningOnExpo = false;
  }
  return isRunningOnExpo;
};
//# sourceMappingURL=misc.js.map