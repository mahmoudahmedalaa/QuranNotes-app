"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toMatrix3x3 = exports.JsiSkPath = void 0;
var _types = require("../types");
var _Host = require("./Host");
var _JsiSkPoint = require("./JsiSkPoint");
var _JsiSkRect = require("./JsiSkRect");
var _JsiSkRRect = require("./JsiSkRRect");
var _JsiSkMatrix = require("./JsiSkMatrix");
const CommandCount = {
  [_types.PathVerb.Move]: 3,
  [_types.PathVerb.Line]: 3,
  [_types.PathVerb.Quad]: 5,
  [_types.PathVerb.Conic]: 6,
  [_types.PathVerb.Cubic]: 7,
  [_types.PathVerb.Close]: 1
};

// Track which deprecation warnings have been shown to avoid spam
const shownDeprecationWarnings = new Set();
const warnDeprecatedPathMethod = (methodName, suggestion) => {
  if (shownDeprecationWarnings.has(methodName)) {
    return;
  }
  shownDeprecationWarnings.add(methodName);
  console.warn(`[react-native-skia] SkPath.${methodName}() is deprecated and will be removed in a future release. ${suggestion} See migration guide: https://shopify.github.io/react-native-skia/docs/shapes/path-migration`);
};
const toMatrix3x3 = m => {
  let matrix = m instanceof _JsiSkMatrix.JsiSkMatrix ? Array.from(_JsiSkMatrix.JsiSkMatrix.fromValue(m)) : m;
  if (matrix.length === 16) {
    matrix = [matrix[0], matrix[1], matrix[3], matrix[4], matrix[5], matrix[7], matrix[12], matrix[13], matrix[15]];
  } else if (matrix.length !== 9) {
    throw new Error(`Invalid matrix length: ${matrix.length}`);
  }
  return matrix;
};

/**
 * SkPath wraps a CK PathBuilder internally, providing both mutable building
 * methods and immutable query methods. Use snapshot() internally to get
 * an immutable CK Path for read-only operations.
 */
exports.toMatrix3x3 = toMatrix3x3;
class JsiSkPath extends _Host.HostObject {
  constructor(CanvasKit, ref) {
    super(CanvasKit, ref, "Path");
  }

  /** Returns an immutable CK Path snapshot for read-only operations. */
  asPath() {
    return this.ref.snapshot();
  }

  /** Extract an immutable CK Path from a JsiSkPath value (for CK interop). */
  static pathFromValue(value) {
    return JsiSkPath.fromValue(value).snapshot();
  }

  // ---- Mutable building methods (deprecated) ----

  addPath(src, matrix, extend = false) {
    warnDeprecatedPathMethod("addPath", "Use Skia.PathBuilder.Make().addPath() instead.");
    const srcBuilder = JsiSkPath.fromValue(src);
    const srcPath = srcBuilder.snapshot();
    const args = [srcPath, ...(matrix ? _JsiSkMatrix.JsiSkMatrix.fromValue(matrix) : []), extend];
    this.ref.addPath(...args);
    srcPath.delete();
    return this;
  }
  addArc(oval, startAngleInDegrees, sweepAngleInDegrees) {
    warnDeprecatedPathMethod("addArc", "Use Skia.PathBuilder.Make().addArc() instead.");
    this.ref.addArc(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees);
    return this;
  }
  addOval(oval, isCCW, startIndex) {
    warnDeprecatedPathMethod("addOval", "Use Skia.Path.Oval() or Skia.PathBuilder.Make().addOval() instead.");
    this.ref.addOval(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, oval), isCCW, startIndex);
    return this;
  }
  addPoly(points, close) {
    warnDeprecatedPathMethod("addPoly", "Use Skia.Path.Polygon() or Skia.PathBuilder.Make().addPoly() instead.");
    this.ref.addPolygon(points.map(p => Array.from(_JsiSkPoint.JsiSkPoint.fromValue(p))).flat(), close);
    return this;
  }
  addRect(rect, isCCW) {
    warnDeprecatedPathMethod("addRect", "Use Skia.Path.Rect() or Skia.PathBuilder.Make().addRect() instead.");
    this.ref.addRect(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
    return this;
  }
  addRRect(rrect, isCCW) {
    warnDeprecatedPathMethod("addRRect", "Use Skia.Path.RRect() or Skia.PathBuilder.Make().addRRect() instead.");
    this.ref.addRRect(_JsiSkRRect.JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
    return this;
  }
  addCircle(x, y, r) {
    warnDeprecatedPathMethod("addCircle", "Use Skia.Path.Circle() or Skia.PathBuilder.Make().addCircle() instead.");
    this.ref.addCircle(x, y, r);
    return this;
  }
  moveTo(x, y) {
    warnDeprecatedPathMethod("moveTo", "Use Skia.PathBuilder.Make().moveTo() instead.");
    this.ref.moveTo(x, y);
    return this;
  }
  rMoveTo(x, y) {
    warnDeprecatedPathMethod("rMoveTo", "Use Skia.PathBuilder.Make().rMoveTo() instead.");
    this.ref.rMoveTo(x, y);
    return this;
  }
  lineTo(x, y) {
    warnDeprecatedPathMethod("lineTo", "Use Skia.PathBuilder.Make().lineTo() instead.");
    this.ref.lineTo(x, y);
    return this;
  }
  rLineTo(x, y) {
    warnDeprecatedPathMethod("rLineTo", "Use Skia.PathBuilder.Make().rLineTo() instead.");
    this.ref.rLineTo(x, y);
    return this;
  }
  quadTo(x1, y1, x2, y2) {
    warnDeprecatedPathMethod("quadTo", "Use Skia.PathBuilder.Make().quadTo() instead.");
    this.ref.quadTo(x1, y1, x2, y2);
    return this;
  }
  rQuadTo(x1, y1, x2, y2) {
    warnDeprecatedPathMethod("rQuadTo", "Use Skia.PathBuilder.Make().rQuadTo() instead.");
    this.ref.rQuadTo(x1, y1, x2, y2);
    return this;
  }
  conicTo(x1, y1, x2, y2, w) {
    warnDeprecatedPathMethod("conicTo", "Use Skia.PathBuilder.Make().conicTo() instead.");
    this.ref.conicTo(x1, y1, x2, y2, w);
    return this;
  }
  rConicTo(x1, y1, x2, y2, w) {
    warnDeprecatedPathMethod("rConicTo", "Use Skia.PathBuilder.Make().rConicTo() instead.");
    this.ref.rConicTo(x1, y1, x2, y2, w);
    return this;
  }
  cubicTo(cpx1, cpy1, cpx2, cpy2, x, y) {
    warnDeprecatedPathMethod("cubicTo", "Use Skia.PathBuilder.Make().cubicTo() instead.");
    this.ref.cubicTo(cpx1, cpy1, cpx2, cpy2, x, y);
    return this;
  }
  rCubicTo(cpx1, cpy1, cpx2, cpy2, x, y) {
    warnDeprecatedPathMethod("rCubicTo", "Use Skia.PathBuilder.Make().rCubicTo() instead.");
    this.ref.rCubicTo(cpx1, cpy1, cpx2, cpy2, x, y);
    return this;
  }
  close() {
    warnDeprecatedPathMethod("close", "Use Skia.PathBuilder.Make().close() instead.");
    this.ref.close();
    return this;
  }
  reset() {
    warnDeprecatedPathMethod("reset", "Use Skia.PathBuilder.Make().reset() instead.");
    // CK PathBuilder has no reset — recreate
    const newBuilder = new this.CanvasKit.PathBuilder();
    if (this.ref !== null && typeof this.ref === "object" && "delete" in this.ref && typeof this.ref.delete === "function") {
      this.ref.delete();
    }
    this.ref = newBuilder;
    return this;
  }
  rewind() {
    warnDeprecatedPathMethod("rewind", "Use Skia.PathBuilder.Make().reset() instead.");
    return this.reset();
  }
  arcToOval(oval, startAngleInDegrees, sweepAngleInDegrees, forceMoveTo) {
    warnDeprecatedPathMethod("arcToOval", "Use Skia.PathBuilder.Make().arcToOval() instead.");
    this.ref.arcToOval(_JsiSkRect.JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees, forceMoveTo);
    return this;
  }
  arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y) {
    warnDeprecatedPathMethod("arcToRotated", "Use Skia.PathBuilder.Make().arcToRotated() instead.");
    this.ref.arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y);
    return this;
  }
  rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy) {
    warnDeprecatedPathMethod("rArcTo", "Use Skia.PathBuilder.Make().rArcTo() instead.");
    this.ref.rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy);
    return this;
  }
  arcToTangent(x1, y1, x2, y2, radius) {
    warnDeprecatedPathMethod("arcToTangent", "Use Skia.PathBuilder.Make().arcToTangent() instead.");
    this.ref.arcToTangent(x1, y1, x2, y2, radius);
    return this;
  }
  setFillType(fill) {
    warnDeprecatedPathMethod("setFillType", "Use Skia.PathBuilder.Make().setFillType() instead.");
    this.ref.setFillType((0, _Host.getEnum)(this.CanvasKit, "FillType", fill));
    return this;
  }
  setIsVolatile(_volatile) {
    warnDeprecatedPathMethod("setIsVolatile", "Use Skia.PathBuilder.Make().setIsVolatile() instead.");
    // Not supported in CK PathBuilder — no-op
    return this;
  }

  // ---- Mutable path operations (deprecated) ----

  offset(dx, dy) {
    warnDeprecatedPathMethod("offset", "Use Skia.PathBuilder.Make().offset() instead.");
    this.ref.offset(dx, dy);
    return this;
  }
  transform(m) {
    warnDeprecatedPathMethod("transform", "Use Skia.PathBuilder.Make().transform() instead.");
    const matrix = toMatrix3x3(m);
    this.ref.transform(matrix);
    return this;
  }
  makeAsWinding() {
    warnDeprecatedPathMethod("makeAsWinding", "Use Skia.Path.AsWinding(path) instead.");
    const path = this.asPath();
    const result = path.makeAsWinding();
    path.delete();
    if (result === null) {
      return null;
    }
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return this;
  }
  simplify() {
    warnDeprecatedPathMethod("simplify", "Use Skia.Path.Simplify(path) instead.");
    const path = this.asPath();
    const result = path.makeSimplified();
    path.delete();
    if (result === null) {
      return false;
    }
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return true;
  }
  op(path, op) {
    warnDeprecatedPathMethod("op", "Use Skia.Path.MakeFromOp() instead.");
    const self = this.asPath();
    const other = JsiSkPath.fromValue(path).snapshot();
    const result = self.makeCombined(other, (0, _Host.getEnum)(this.CanvasKit, "PathOp", op));
    self.delete();
    other.delete();
    if (result === null) {
      return false;
    }
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return true;
  }
  dash(on, off, phase) {
    warnDeprecatedPathMethod("dash", "Use Skia.Path.Dash(path, on, off, phase) instead.");
    const path = this.asPath();
    const result = path.makeDashed(on, off, phase);
    path.delete();
    if (result === null) {
      return false;
    }
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return true;
  }
  stroke(opts) {
    warnDeprecatedPathMethod("stroke", "Use Skia.Path.Stroke(path, opts) instead.");
    const path = this.asPath();
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
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return this;
  }
  trim(start, stop, isComplement) {
    warnDeprecatedPathMethod("trim", "Use Skia.Path.Trim(path, start, end, isComplement) instead.");
    const startT = Math.min(Math.max(start, 0), 1);
    const stopT = Math.min(Math.max(stop, 0), 1);
    if (startT === 0 && stopT === 1 && !isComplement) {
      return this;
    }
    const path = this.asPath();
    const result = path.makeTrimmed(startT, stopT, isComplement);
    path.delete();
    if (result === null) {
      return null;
    }
    const old = this.ref;
    this.ref = new this.CanvasKit.PathBuilder(result);
    result.delete();
    old.delete();
    return this;
  }

  // ---- Query methods (use snapshot for read-only) ----

  countPoints() {
    return this.ref.countPoints();
  }
  computeTightBounds() {
    const path = this.asPath();
    const result = new _JsiSkRect.JsiSkRect(this.CanvasKit, path.computeTightBounds());
    path.delete();
    return result;
  }
  contains(x, y) {
    const path = this.asPath();
    const result = path.contains(x, y);
    path.delete();
    return result;
  }
  copy() {
    const path = this.asPath();
    const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  equals(other) {
    const p1 = this.asPath();
    const p2 = JsiSkPath.fromValue(other).snapshot();
    const result = p1.equals(p2);
    p1.delete();
    p2.delete();
    return result;
  }
  getBounds() {
    return new _JsiSkRect.JsiSkRect(this.CanvasKit, this.ref.getBounds());
  }
  getFillType() {
    const path = this.asPath();
    const result = path.getFillType().value;
    path.delete();
    return result;
  }
  getPoint(index) {
    const path = this.asPath();
    const result = new _JsiSkPoint.JsiSkPoint(this.CanvasKit, path.getPoint(index));
    path.delete();
    return result;
  }
  isEmpty() {
    return this.ref.isEmpty();
  }
  isVolatile() {
    return false;
  }
  getLastPt() {
    const count = this.ref.countPoints();
    if (count === 0) {
      return {
        x: 0,
        y: 0
      };
    }
    const path = this.asPath();
    const pt = path.getPoint(count - 1);
    path.delete();
    return {
      x: pt[0],
      y: pt[1]
    };
  }
  toSVGString() {
    const path = this.asPath();
    const result = path.toSVGString();
    path.delete();
    return result;
  }
  isInterpolatable(path2) {
    const p1 = this.asPath();
    const p2 = JsiSkPath.fromValue(path2).snapshot();
    const result = this.CanvasKit.Path.CanInterpolate(p1, p2);
    p1.delete();
    p2.delete();
    return result;
  }
  interpolate(end, weight, output) {
    const p1 = this.asPath();
    const p2 = JsiSkPath.fromValue(end).snapshot();
    const path = this.CanvasKit.Path.MakeFromPathInterpolation(p1, p2, weight);
    p1.delete();
    p2.delete();
    if (path === null) {
      return null;
    }
    if (output) {
      const outRef = output;
      const old = outRef.ref;
      outRef.ref = new this.CanvasKit.PathBuilder(path);
      path.delete();
      old.delete();
      return output;
    }
    const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  toCmds() {
    const path = this.asPath();
    const cmds = path.toCmds();
    path.delete();
    const result = cmds.reduce((acc, cmd, i) => {
      if (i === 0) {
        acc.push([]);
      }
      const current = acc[acc.length - 1];
      if (current.length === 0) {
        current.push(cmd);
        const length = CommandCount[current[0]];
        if (current.length === length && i !== cmds.length - 1) {
          acc.push([]);
        }
      } else {
        const length = CommandCount[current[0]];
        if (current.length < length) {
          current.push(cmd);
        }
        if (current.length === length && i !== cmds.length - 1) {
          acc.push([]);
        }
      }
      return acc;
    }, []);
    return result;
  }
}
exports.JsiSkPath = JsiSkPath;
//# sourceMappingURL=JsiSkPath.js.map