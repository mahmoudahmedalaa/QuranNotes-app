"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsiSkPathFactory = void 0;
var _Host = require("./Host");
var _JsiSkPath = require("./JsiSkPath");
var _JsiSkPoint = require("./JsiSkPoint");
var _JsiSkRect = require("./JsiSkRect");
var _JsiSkRRect = require("./JsiSkRRect");
const pinT = t => Math.min(Math.max(t, 0), 1);
class JsiSkPathFactory extends _Host.Host {
  constructor(CanvasKit) {
    super(CanvasKit);
  }
  Make() {
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder());
  }
  MakeFromSVGString(str) {
    const path = this.CanvasKit.Path.MakeFromSVGString(str);
    if (path === null) {
      return null;
    }
    const result = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromOp(one, two, op) {
    const p1 = _JsiSkPath.JsiSkPath.fromValue(one).snapshot();
    const p2 = _JsiSkPath.JsiSkPath.fromValue(two).snapshot();
    const path = this.CanvasKit.Path.MakeFromOp(p1, p2, (0, _Host.getEnum)(this.CanvasKit, "PathOp", op));
    p1.delete();
    p2.delete();
    if (path === null) {
      return null;
    }
    const result = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromCmds(cmds) {
    const path = this.CanvasKit.Path.MakeFromCmds(cmds.flat());
    if (path === null) {
      return null;
    }
    const result = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromText(_text, _x, _y, _font) {
    return (0, _Host.throwNotImplementedOnRNWeb)();
  }

  // Static shape factories

  Rect(rect, isCCW) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addRect(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }
  Oval(rect, isCCW, startIndex) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addOval(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, rect), isCCW, startIndex);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }
  Circle(x, y, r) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addCircle(x, y, r);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }
  RRect(rrect, isCCW) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addRRect(_JsiSkRRect.JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }
  Line(p1, p2) {
    const builder = new this.CanvasKit.PathBuilder();
    const pt1 = _JsiSkPoint.JsiSkPoint.fromValue(p1);
    const pt2 = _JsiSkPoint.JsiSkPoint.fromValue(p2);
    builder.moveTo(pt1[0], pt1[1]);
    builder.lineTo(pt2[0], pt2[1]);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }
  Polygon(points, close) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addPolygon(points.map(p => Array.from(_JsiSkPoint.JsiSkPoint.fromValue(p))).flat(), close);
    return new _JsiSkPath.JsiSkPath(this.CanvasKit, builder);
  }

  // Static path operations

  Stroke(srcPath, opts) {
    const path = _JsiSkPath.JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeStroked(opts === undefined ? undefined : {
      width: opts.width,
      // eslint-disable-next-line camelcase
      miter_limit: opts.miter_limit,
      precision: opts.precision,
      join: (0, _Host.optEnum)(this.CanvasKit, "StrokeJoin", opts.join),
      cap: (0, _Host.optEnum)(this.CanvasKit, "StrokeCap", opts.cap)
    });
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Trim(srcPath, start, end, isComplement) {
    const startT = pinT(start);
    const stopT = pinT(end);
    const path = _JsiSkPath.JsiSkPath.fromValue(srcPath).snapshot();
    if (startT <= 0 && stopT >= 1 && !isComplement) {
      const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
      path.delete();
      return r;
    }
    const result = path.makeTrimmed(startT, stopT, isComplement);
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Simplify(srcPath) {
    const path = _JsiSkPath.JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeSimplified();
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Dash(srcPath, on, off, phase) {
    const path = _JsiSkPath.JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeDashed(on, off, phase);
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  AsWinding(srcPath) {
    const path = _JsiSkPath.JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeAsWinding();
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Interpolate(start, end, weight) {
    const p1 = _JsiSkPath.JsiSkPath.fromValue(start).snapshot();
    const p2 = _JsiSkPath.JsiSkPath.fromValue(end).snapshot();
    const path = this.CanvasKit.Path.MakeFromPathInterpolation(p1, p2, weight);
    p1.delete();
    p2.delete();
    if (path === null) {
      return null;
    }
    const r = new _JsiSkPath.JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return r;
  }
}
exports.JsiSkPathFactory = JsiSkPathFactory;
//# sourceMappingURL=JsiSkPathFactory.js.map