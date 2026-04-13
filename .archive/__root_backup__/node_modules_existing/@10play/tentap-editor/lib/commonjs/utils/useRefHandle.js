"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useRefHandle = void 0;
var _react = require("react");
var _reactNative = require("react-native");
const useRefHandle = compRef => {
  const [handle, setHandle] = (0, _react.useState)();
  (0, _react.useEffect)(() => {
    if (compRef.current) {
      const reactTag = (0, _reactNative.findNodeHandle)(compRef.current);
      setHandle(reactTag || undefined);
    }
  }, [compRef]);
  return handle;
};
exports.useRefHandle = useRefHandle;
//# sourceMappingURL=useRefHandle.js.map