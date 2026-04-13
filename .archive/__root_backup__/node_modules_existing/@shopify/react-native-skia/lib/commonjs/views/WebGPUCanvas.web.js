"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebGPUCanvas = void 0;
var _react = _interopRequireDefault(require("react"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// WebGPU Canvas is not supported on web
const WebGPUCanvas = ({
  transparent: _transparent,
  ref: _ref,
  ...props
}) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return /*#__PURE__*/_react.default.createElement("div", props);
};
exports.WebGPUCanvas = WebGPUCanvas;
//# sourceMappingURL=WebGPUCanvas.web.js.map