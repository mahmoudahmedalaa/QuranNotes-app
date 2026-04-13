"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebGPUCanvas = void 0;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _WebGPUViewNativeComponent = _interopRequireDefault(require("../specs/WebGPUViewNativeComponent"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
let CONTEXT_COUNTER = 1;
function generateContextId() {
  return CONTEXT_COUNTER++;
}
const WebGPUCanvas = ({
  transparent,
  ref,
  ...props
}) => {
  const viewRef = (0, _react.useRef)(null);
  const [contextId] = (0, _react.useState)(() => generateContextId());
  (0, _react.useImperativeHandle)(ref, () => ({
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
  if (_reactNative.Platform.OS === "web") {
    return /*#__PURE__*/_react.default.createElement(_reactNative.View, props);
  }
  return /*#__PURE__*/_react.default.createElement(_reactNative.View, _extends({
    collapsable: false,
    ref: viewRef
  }, props), /*#__PURE__*/_react.default.createElement(_WebGPUViewNativeComponent.default, {
    style: {
      flex: 1
    },
    contextId: contextId,
    transparent: !!transparent
  }));
};
exports.WebGPUCanvas = WebGPUCanvas;
//# sourceMappingURL=WebGPUCanvas.js.map