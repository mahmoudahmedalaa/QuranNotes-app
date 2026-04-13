function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import React, { useImperativeHandle, useRef, useState } from "react";
import { View, Platform } from "react-native";
import WebGPUNativeView from "../specs/WebGPUViewNativeComponent";
let CONTEXT_COUNTER = 1;
function generateContextId() {
  return CONTEXT_COUNTER++;
}
export const WebGPUCanvas = ({
  transparent,
  ref,
  ...props
}) => {
  const viewRef = useRef(null);
  const [contextId] = useState(() => generateContextId());
  useImperativeHandle(ref, () => ({
    getContextId: () => contextId,
    getNativeSurface: () => {
      if (typeof RNWebGPU === "undefined") {
        throw new Error("[WebGPU] RNWebGPU is not available. Make sure SK_GRAPHITE is enabled.");
      }
      return RNWebGPU.getNativeSurface(contextId);
    },
    getContext(contextName) {
      if (contextName !== "webgpu") {
        throw new Error(`[WebGPU] Unsupported context: ${contextName}`);
      }
      if (!viewRef.current) {
        throw new Error("[WebGPU] Cannot get context before mount");
      }
      if (typeof RNWebGPU === "undefined") {
        throw new Error("[WebGPU] RNWebGPU is not available. Make sure SK_GRAPHITE is enabled.");
      }
      // getBoundingClientRect became stable in RN 0.83
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = viewRef.current;
      const size = "getBoundingClientRect" in view ? view.getBoundingClientRect() : view.unstable_getBoundingClientRect();
      return RNWebGPU.MakeWebGPUCanvasContext(contextId, size.width, size.height);
    }
  }));

  // WebGPU Canvas is not supported on web
  if (Platform.OS === "web") {
    return /*#__PURE__*/React.createElement(View, props);
  }
  return /*#__PURE__*/React.createElement(View, _extends({
    collapsable: false,
    ref: viewRef
  }, props), /*#__PURE__*/React.createElement(WebGPUNativeView, {
    style: {
      flex: 1
    },
    contextId: contextId,
    transparent: !!transparent
  }));
};
//# sourceMappingURL=WebGPUCanvas.js.map