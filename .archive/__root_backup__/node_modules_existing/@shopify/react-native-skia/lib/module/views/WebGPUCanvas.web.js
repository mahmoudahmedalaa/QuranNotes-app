import React from "react";
// WebGPU Canvas is not supported on web
export const WebGPUCanvas = ({
  transparent: _transparent,
  ref: _ref,
  ...props
}) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return /*#__PURE__*/React.createElement("div", props);
};
//# sourceMappingURL=WebGPUCanvas.web.js.map