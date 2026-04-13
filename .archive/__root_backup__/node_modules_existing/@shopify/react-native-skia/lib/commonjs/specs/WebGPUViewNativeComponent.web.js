"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = WebGPUViewNativeComponent;
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _utils = require("./utils");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce(func, wait, immediate = false) {
  let timeout;
  return function debounced(...args) {
    const context = this;
    const callNow = immediate && !timeout;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = undefined;
      if (!immediate) {
        func.apply(context, args);
      }
    }, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}
function resizeCanvas(canvas) {
  if (!canvas) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const {
    height,
    width
  } = canvas.getBoundingClientRect();
  canvas.setAttribute("height", (height * dpr).toString());
  canvas.setAttribute("width", (width * dpr).toString());
}

// eslint-disable-next-line import/no-default-export
function WebGPUViewNativeComponent(props) {
  const {
    contextId,
    style,
    transparent,
    ...rest
  } = props;
  const canvasElm = (0, _react.useRef)(null);
  (0, _react.useEffect)(() => {
    const onResize = debounce(() => resizeCanvas(canvasElm.current), 100);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return /*#__PURE__*/_react.default.createElement("canvas", {
    ...rest,
    id: (0, _utils.contextIdToId)(contextId),
    style: {
      ...styles.view,
      ...styles.flex1,
      ...(transparent === false ? {
        backgroundColor: "white"
      } : {}),
      ...(typeof style === "object" ? style : {})
    },
    ref: ref => {
      canvasElm.current = ref;
      if (ref) {
        resizeCanvas(ref);
      }
    }
  });
}
const styles = _reactNative.StyleSheet.create({
  flex1: {
    flex: 1
  },
  view: {
    alignItems: "stretch",
    backgroundColor: "transparent",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    border: "0 solid black",
    boxSizing: "border-box",
    display: "flex",
    flexBasis: "auto",
    flexDirection: "column",
    flexShrink: 0,
    listStyle: "none",
    margin: 0,
    minHeight: 0,
    minWidth: 0,
    padding: 0,
    position: "relative",
    zIndex: 0
  }
});
//# sourceMappingURL=WebGPUViewNativeComponent.web.js.map