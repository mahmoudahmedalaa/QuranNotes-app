import type { CanvasKit, PathBuilder as CKPathBuilder } from "canvaskit-wasm";
import type { FillType, InputMatrix, InputRRect, SkMatrix, SkPath, SkPathBuilder, SkPoint, SkRect } from "../types";
import { HostObject } from "./Host";
/**
 * Web implementation of SkPathBuilder using CanvasKit's native PathBuilder.
 */
export declare class JsiSkPathBuilder extends HostObject<CKPathBuilder, "PathBuilder"> implements SkPathBuilder {
    constructor(CanvasKit: CanvasKit, ref: CKPathBuilder);
    moveTo(x: number, y: number): this;
    rMoveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    rLineTo(x: number, y: number): this;
    quadTo(x1: number, y1: number, x2: number, y2: number): this;
    rQuadTo(x1: number, y1: number, x2: number, y2: number): this;
    conicTo(x1: number, y1: number, x2: number, y2: number, w: number): this;
    rConicTo(x1: number, y1: number, x2: number, y2: number, w: number): this;
    cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
    rCubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
    close(): this;
    arcToOval(oval: SkRect, startAngleInDegrees: number, sweepAngleInDegrees: number, forceMoveTo: boolean): this;
    arcToRotated(rx: number, ry: number, xAxisRotateInDegrees: number, useSmallArc: boolean, isCCW: boolean, x: number, y: number): this;
    rArcTo(rx: number, ry: number, xAxisRotateInDegrees: number, useSmallArc: boolean, isCCW: boolean, dx: number, dy: number): this;
    arcToTangent(x1: number, y1: number, x2: number, y2: number, radius: number): this;
    addRect(rect: SkRect, isCCW?: boolean): this;
    addOval(oval: SkRect, isCCW?: boolean, startIndex?: number): this;
    addArc(oval: SkRect, startAngleInDegrees: number, sweepAngleInDegrees: number): this;
    addRRect(rrect: InputRRect, isCCW?: boolean): this;
    addCircle(x: number, y: number, r: number, _isCCW?: boolean): this;
    addPoly(points: SkPoint[], close: boolean): this;
    addPath(src: SkPath, matrix?: SkMatrix, extend?: boolean): this;
    setFillType(fill: FillType): this;
    setIsVolatile(_isVolatile: boolean): this;
    reset(): this;
    offset(dx: number, dy: number): this;
    transform(m: InputMatrix): this;
    computeBounds(): SkRect;
    isEmpty(): boolean;
    getLastPt(): {
        x: number;
        y: number;
    };
    countPoints(): number;
    build(): SkPath;
    detach(): SkPath;
}
