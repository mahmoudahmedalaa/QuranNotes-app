import { Host, getEnum, optEnum, throwNotImplementedOnRNWeb } from "./Host";
import { JsiSkPath } from "./JsiSkPath";
import { JsiSkPoint } from "./JsiSkPoint";
import { JsiSkRect } from "./JsiSkRect";
import { JsiSkRRect } from "./JsiSkRRect";
const pinT = t => Math.min(Math.max(t, 0), 1);
export class JsiSkPathFactory extends Host {
  constructor(CanvasKit) {
    super(CanvasKit);
  }
  Make() {
    return new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder());
  }
  MakeFromSVGString(str) {
    const path = this.CanvasKit.Path.MakeFromSVGString(str);
    if (path === null) {
      return null;
    }
    const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromOp(one, two, op) {
    const p1 = JsiSkPath.fromValue(one).snapshot();
    const p2 = JsiSkPath.fromValue(two).snapshot();
    const path = this.CanvasKit.Path.MakeFromOp(p1, p2, getEnum(this.CanvasKit, "PathOp", op));
    p1.delete();
    p2.delete();
    if (path === null) {
      return null;
    }
    const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromCmds(cmds) {
    const path = this.CanvasKit.Path.MakeFromCmds(cmds.flat());
    if (path === null) {
      return null;
    }
    const result = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return result;
  }
  MakeFromText(_text, _x, _y, _font) {
    return throwNotImplementedOnRNWeb();
  }

  // Static shape factories

  Rect(rect, isCCW) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addRect(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW);
    return new JsiSkPath(this.CanvasKit, builder);
  }
  Oval(rect, isCCW, startIndex) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addOval(JsiSkRect.fromValue(this.CanvasKit, rect), isCCW, startIndex);
    return new JsiSkPath(this.CanvasKit, builder);
  }
  Circle(x, y, r) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addCircle(x, y, r);
    return new JsiSkPath(this.CanvasKit, builder);
  }
  RRect(rrect, isCCW) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addRRect(JsiSkRRect.fromValue(this.CanvasKit, rrect), isCCW);
    return new JsiSkPath(this.CanvasKit, builder);
  }
  Line(p1, p2) {
    const builder = new this.CanvasKit.PathBuilder();
    const pt1 = JsiSkPoint.fromValue(p1);
    const pt2 = JsiSkPoint.fromValue(p2);
    builder.moveTo(pt1[0], pt1[1]);
    builder.lineTo(pt2[0], pt2[1]);
    return new JsiSkPath(this.CanvasKit, builder);
  }
  Polygon(points, close) {
    const builder = new this.CanvasKit.PathBuilder();
    builder.addPolygon(points.map(p => Array.from(JsiSkPoint.fromValue(p))).flat(), close);
    return new JsiSkPath(this.CanvasKit, builder);
  }

  // Static path operations

  Stroke(srcPath, opts) {
    const path = JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeStroked(opts === undefined ? undefined : {
      width: opts.width,
      // eslint-disable-next-line camelcase
      miter_limit: opts.miter_limit,
      precision: opts.precision,
      join: optEnum(this.CanvasKit, "StrokeJoin", opts.join),
      cap: optEnum(this.CanvasKit, "StrokeCap", opts.cap)
    });
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Trim(srcPath, start, end, isComplement) {
    const startT = pinT(start);
    const stopT = pinT(end);
    const path = JsiSkPath.fromValue(srcPath).snapshot();
    if (startT <= 0 && stopT >= 1 && !isComplement) {
      const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
      path.delete();
      return r;
    }
    const result = path.makeTrimmed(startT, stopT, isComplement);
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Simplify(srcPath) {
    const path = JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeSimplified();
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Dash(srcPath, on, off, phase) {
    const path = JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeDashed(on, off, phase);
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  AsWinding(srcPath) {
    const path = JsiSkPath.fromValue(srcPath).snapshot();
    const result = path.makeAsWinding();
    path.delete();
    if (result === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(result));
    result.delete();
    return r;
  }
  Interpolate(start, end, weight) {
    const p1 = JsiSkPath.fromValue(start).snapshot();
    const p2 = JsiSkPath.fromValue(end).snapshot();
    const path = this.CanvasKit.Path.MakeFromPathInterpolation(p1, p2, weight);
    p1.delete();
    p2.delete();
    if (path === null) {
      return null;
    }
    const r = new JsiSkPath(this.CanvasKit, new this.CanvasKit.PathBuilder(path));
    path.delete();
    return r;
  }
}
//# sourceMappingURL=JsiSkPathFactory.js.map