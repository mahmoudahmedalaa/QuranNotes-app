"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsiSkPathEffectFactory = void 0;
var _Host = require("./Host");
var _JsiSkMatrix = require("./JsiSkMatrix");
var _JsiSkPath = require("./JsiSkPath");
var _JsiSkPathEffect = require("./JsiSkPathEffect");
class JsiSkPathEffectFactory extends _Host.Host {
  constructor(CanvasKit) {
    super(CanvasKit);
  }
  MakeCorner(radius) {
    const pe = this.CanvasKit.PathEffect.MakeCorner(radius);
    if (pe === null) {
      return null;
    }
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
  MakeDash(intervals, phase) {
    const pe = this.CanvasKit.PathEffect.MakeDash(intervals, phase);
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
  MakeDiscrete(segLength, dev, seedAssist) {
    const pe = this.CanvasKit.PathEffect.MakeDiscrete(segLength, dev, seedAssist);
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
  MakeCompose(_outer, _inner) {
    return (0, _Host.throwNotImplementedOnRNWeb)();
  }
  MakeSum(_outer, _inner) {
    return (0, _Host.throwNotImplementedOnRNWeb)();
  }
  MakeLine2D(width, matrix) {
    const pe = this.CanvasKit.PathEffect.MakeLine2D(width, _JsiSkMatrix.JsiSkMatrix.fromValue(matrix));
    if (pe === null) {
      return null;
    }
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
  MakePath1D(path, advance, phase, style) {
    const p = _JsiSkPath.JsiSkPath.pathFromValue(path);
    const pe = this.CanvasKit.PathEffect.MakePath1D(p, advance, phase, (0, _Host.getEnum)(this.CanvasKit, "Path1DEffect", style));
    p.delete();
    if (pe === null) {
      return null;
    }
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
  MakePath2D(matrix, path) {
    const p = _JsiSkPath.JsiSkPath.pathFromValue(path);
    const pe = this.CanvasKit.PathEffect.MakePath2D(_JsiSkMatrix.JsiSkMatrix.fromValue(matrix), p);
    p.delete();
    if (pe === null) {
      return null;
    }
    return new _JsiSkPathEffect.JsiSkPathEffect(this.CanvasKit, pe);
  }
}
exports.JsiSkPathEffectFactory = JsiSkPathEffectFactory;
//# sourceMappingURL=JsiSkPathEffectFactory.js.map