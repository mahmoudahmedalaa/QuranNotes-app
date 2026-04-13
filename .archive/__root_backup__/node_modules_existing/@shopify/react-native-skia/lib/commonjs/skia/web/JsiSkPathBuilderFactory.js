"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsiSkPathBuilderFactory = void 0;
var _Host = require("./Host");
var _JsiSkPath = require("./JsiSkPath");
var _JsiSkPathBuilder = require("./JsiSkPathBuilder");
class JsiSkPathBuilderFactory extends _Host.Host {
  constructor(CanvasKit) {
    super(CanvasKit);
  }
  Make() {
    return new _JsiSkPathBuilder.JsiSkPathBuilder(this.CanvasKit, new this.CanvasKit.PathBuilder());
  }
  MakeFromPath(path) {
    const srcBuilder = _JsiSkPath.JsiSkPath.fromValue(path);
    const srcPath = srcBuilder.snapshot();
    const builder = new this.CanvasKit.PathBuilder(srcPath);
    srcPath.delete();
    return new _JsiSkPathBuilder.JsiSkPathBuilder(this.CanvasKit, builder);
  }
}
exports.JsiSkPathBuilderFactory = JsiSkPathBuilderFactory;
//# sourceMappingURL=JsiSkPathBuilderFactory.js.map