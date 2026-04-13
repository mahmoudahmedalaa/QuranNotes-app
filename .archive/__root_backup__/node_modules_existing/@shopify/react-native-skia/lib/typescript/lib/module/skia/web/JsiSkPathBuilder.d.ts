/**
 * Web implementation of SkPathBuilder using CanvasKit's native PathBuilder.
 */
export class JsiSkPathBuilder extends HostObject {
    constructor(CanvasKit: any, ref: any);
    moveTo(x: any, y: any): this;
    rMoveTo(x: any, y: any): this;
    lineTo(x: any, y: any): this;
    rLineTo(x: any, y: any): this;
    quadTo(x1: any, y1: any, x2: any, y2: any): this;
    rQuadTo(x1: any, y1: any, x2: any, y2: any): this;
    conicTo(x1: any, y1: any, x2: any, y2: any, w: any): this;
    rConicTo(x1: any, y1: any, x2: any, y2: any, w: any): this;
    cubicTo(x1: any, y1: any, x2: any, y2: any, x3: any, y3: any): this;
    rCubicTo(x1: any, y1: any, x2: any, y2: any, x3: any, y3: any): this;
    close(): this;
    arcToOval(oval: any, startAngleInDegrees: any, sweepAngleInDegrees: any, forceMoveTo: any): this;
    arcToRotated(rx: any, ry: any, xAxisRotateInDegrees: any, useSmallArc: any, isCCW: any, x: any, y: any): this;
    rArcTo(rx: any, ry: any, xAxisRotateInDegrees: any, useSmallArc: any, isCCW: any, dx: any, dy: any): this;
    arcToTangent(x1: any, y1: any, x2: any, y2: any, radius: any): this;
    addRect(rect: any, isCCW: any): this;
    addOval(oval: any, isCCW: any, startIndex: any): this;
    addArc(oval: any, startAngleInDegrees: any, sweepAngleInDegrees: any): this;
    addRRect(rrect: any, isCCW: any): this;
    addCircle(x: any, y: any, r: any, _isCCW: any): this;
    addPoly(points: any, close: any): this;
    addPath(src: any, matrix: any, extend?: boolean): this;
    setFillType(fill: any): this;
    setIsVolatile(_isVolatile: any): this;
    reset(): this;
    offset(dx: any, dy: any): this;
    transform(m: any): this;
    computeBounds(): JsiSkRect;
    isEmpty(): any;
    getLastPt(): {
        x: any;
        y: any;
    };
    countPoints(): any;
    build(): JsiSkPath;
    detach(): JsiSkPath;
}
import { HostObject } from "./Host";
import { JsiSkRect } from "./JsiSkRect";
import { JsiSkPath } from "./JsiSkPath";
