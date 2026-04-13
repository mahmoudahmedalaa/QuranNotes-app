"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.contextIdToId = contextIdToId;
// Only used on the web
function contextIdToId(contextId) {
  return "rnwgpu-canvas-" + contextId;
}
//# sourceMappingURL=utils.js.map