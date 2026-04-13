import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { contextIdToId } from "./utils";
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
export default function WebGPUViewNativeComponent(props) {
  const {
    contextId,
    style,
    transparent,
    ...rest
  } = props;
  const canvasElm = useRef(null);
  useEffect(() => {
    const onResize = debounce(() => resizeCanvas(canvasElm.current), 100);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);
  return /*#__PURE__*/React.createElement("canvas", {
    ...rest,
    id: contextIdToId(contextId),
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
const styles = StyleSheet.create({
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