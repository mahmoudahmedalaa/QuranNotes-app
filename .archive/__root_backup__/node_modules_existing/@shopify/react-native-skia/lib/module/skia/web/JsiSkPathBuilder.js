import { getEnum, HostObject } from "./Host";
import { JsiSkPath, toMatrix3x3 } from "./JsiSkPath";
import { JsiSkMatrix } from "./JsiSkMatrix";
import { JsiSkPoint } from "./JsiSkPoint";
import { JsiSkRect } from "./JsiSkRect";
import { JsiSkRRect } from "./JsiSkRRect";

/**
 * Web implementation of SkPathBuilder using CanvasKit's native PathBuilder.
 */
export class JsiSkPathBuilder extends HostObject {
  constructor(CanvasKit, ref) {
    super(CanvasKit, ref, "PathBuilder");
  }

  // Movement methods
  moveTo(x, y) {
    this.ref.moveTo(x, y);
    return this;
  }
  rMoveTo(x, y) {
    this.ref.rMoveTo(x, y);
    return this;
  }
  lineTo(x, y) {
    this.ref.lineTo(x, y);
    return this;
  }
  rLineTo(x, y) {
    this.ref.rLineTo(x, y);
    return this;
  }

  // Curve methods
  quadTo(x1, y1, x2, y2) {
    this.ref.quadTo(x1, y1, x2, y2);
    return this;
  }
  rQuadTo(x1, y1, x2, y2) {
    this.ref.rQuadTo(x1, y1, x2, y2);
    return this;
  }
  conicTo(x1, y1, x2, y2, w) {
    this.ref.conicTo(x1, y1, x2, y2, w);
    return this;
  }
  rConicTo(x1, y1, x2, y2, w) {
    this.ref.rConicTo(x1, y1, x2, y2, w);
    return this;
  }
  cubicTo(x1, y1, x2, y2, x3, y3) {
    this.ref.cubicTo(x1, y1, x2, y2, x3, y3);
    return this;
  }
  rCubicTo(x1, y1, x2, y2, x3, y3) {
    this.ref.rCubicTo(x1, y1, x2, y2, x3, y3);
    return this;
  }
  close() {
    this.ref.close();
    return this;
  }

  // Arc methods
  arcToOval(oval, startAngleInDegrees, sweepAngleInDegrees, forceMoveTo) {
    this.ref.arcToOval(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees, forceMoveTo);
    return this;
  }
  arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y) {
    this.ref.arcToRotated(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, x, y);
    return this;
  }
  rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy) {
    this.ref.rArcTo(rx, ry, xAxisRotateInDegrees, useSmallArc, isCCW, dx, dy);
    return this;
  }
  arcToTangent(x1, y1, x2, y2, radius) {
    this.ref.arcToTangent(x1, y1, x2, y2, radius);
    return this;
  }

  // Shape methods
  addRect(rect, isCCW) {
    this.ref.addRect(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
    return this;
  }
  addOval(oval, isCCW, startIndex) {
    this.ref.addOval(JsiSkRect.fromValue(this.CanvasKit, oval), isCCW, startIndex);
    return this;
  }
  addArc(oval, startAngleInDegrees, sweepAngleInDegrees) {
    this.ref.addArc(JsiSkRect.fromValue(this.CanvasKit, oval), startAngleInDegrees, sweepAngleInDegrees);
    return this;
  }
  addRRect(rrect, isCCW) {
    this.ref.addRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
    return this;
  }
  addCircle(x, y, r, _isCCW) {
    this.ref.addCircle(x, y, r);
    return this;
  }
  addPoly(points, close) {
    this.ref.addPolygon(points.map(p => Array.from(JsiSkPoint.fromValue(p))).flat(), close);
    return this;
  }
  addPath(src, matrix, extend = false) {
    const srcPath = JsiSkPath.pathFromValue(src);
    const args = [srcPath, ...(matrix ? JsiSkMatrix.fromValue(matrix) : []), extend];
    this.ref.addPath(...args);
    srcPath.delete();
    return this;
  }

  // Configuration methods
  setFillType(fill) {
    this.ref.setFillType(getEnum(this.CanvasKit, "FillType", fill));
    return this;
  }
  setIsVolatile(_isVolatile) {
    // Not supported in CanvasKit PathBuilder - no-op
    return this;
  }
  reset() {
    // CanvasKit PathBuilder doesn't have reset - recreate
    const newBuilder = new this.CanvasKit.PathBuilder();
    // Swap the ref - delete old one
    if (this.ref !== null && typeof this.ref === "object" && "delete" in this.ref && typeof this.ref.delete === "function") {
      this.ref.delete();
    }
    this.ref = newBuilder;
    return this;
  }
  offset(dx, dy) {
    this.ref.offset(dx, dy);
    return this;
  }
  transform(m) {
    const matrix = toMatrix3x3(m);
    this.ref.transform(matrix);
    return this;
  }

  // Query methods
  computeBounds() {
    return new JsiSkRect(this.CanvasKit, this.ref.getBounds());
  }
  isEmpty() {
    return this.ref.isEmpty();
  }
  getLastPt() {
    const count = this.ref.countPoints();
    if (count === 0) {
      return {
        x: 0,
        y: 0
      };
    }
    // PathBuilder doesn't have getPoint - snapshot to get it
    const path = this.ref.snapshot();
    const pt = path.getPoint(count - 1);
    path.delete();
    return {
      x: pt[0],
      y: pt[1]
    };
  }
  countPoints() {
    return this.ref.countPoints();
  }

  // Build methods
  build() {
    const path = this.ref.snapshot();
    const builder = new this.CanvasKit.PathBuilder(path);
    path.delete();
    return new JsiSkPath(this.CanvasKit, builder);
  }
  detach() {
    const path = this.ref.detach();
    const builder = new this.CanvasKit.PathBuilder(path);
    path.delete();
    return new JsiSkPath(this.CanvasKit, builder);
  }
}
//# sourceMappingURL=JsiSkPathBuilder.js.map