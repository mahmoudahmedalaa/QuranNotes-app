import type { CanvasKit, PathBuilder as CKPathBuilder } from "canvaskit-wasm";
import type { FillType, PathCommand, PathOp, SkMatrix, SkPath, SkPoint, SkRect, InputRRect, StrokeOpts, InputMatrix } from "../types";
import { HostObject } from "./Host";
import { JsiSkRect } from "./JsiSkRect";
export declare const toMatrix3x3: (m: InputMatrix) => number[];
/**
 * SkPath wraps a CK PathBuilder internally, providing both mutable building
 * methods and immutable query methods. Use snapshot() internally to get
 * an immutable CK Path for read-only operations.
 */
export declare class JsiSkPath extends HostObject<CKPathBuilder, "Path"> implements SkPath {
    constructor(CanvasKit: CanvasKit, ref: CKPathBuilder);
    /** Returns an immutable CK Path snapshot for read-only operations. */
    private asPath;
    /** Extract an immutable CK Path from a JsiSkPath value (for CK interop). */
    static pathFromValue(value: SkPath): import("canvaskit-wasm").Path;
    addPath(src: SkPath, matrix?: SkMatrix, extend?: boolean): this;
    addArc(oval: SkRect, startAngleInDegrees: number, sweepAngleInDegrees: number): this;
    addOval(oval: SkRect, isCCW?: boolean, startIndex?: number): this;
    addPoly(points: SkPoint[], close: boolean): this;
    addRect(rect: SkRect, isCCW?: boolean): this;
    addRRect(rrect: InputRRect, isCCW?: boolean): this;
    addCircle(x: number, y: number, r: number): this;
    moveTo(x: number, y: number): this;
    rMoveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    rLineTo(x: number, y: number): this;
    quadTo(x1: number, y1: number, x2: number, y2: number): this;
    rQuadTo(x1: number, y1: number, x2: number, y2: number): this;
    conicTo(x1: number, y1: number, x2: number, y2: number, w: number): this;
    rConicTo(x1: number, y1: number, x2: number, y2: number, w: number): this;
    cubicTo(cpx1: number, cpy1: number, cpx2: number, cpy2: number, x: number, y: number): this;
    rCubicTo(cpx1: number, cpy1: number, cpx2: number, cpy2: number, x: number, y: number): this;
    close(): this;
    reset(): this;
    rewind(): this;
    arcToOval(oval: SkRect, startAngleInDegrees: number, sweepAngleInDegrees: number, forceMoveTo: boolean): this;
    arcToRotated(rx: number, ry: number, xAxisRotateInDegrees: number, useSmallArc: boolean, isCCW: boolean, x: number, y: number): this;
    rArcTo(rx: number, ry: number, xAxisRotateInDegrees: number, useSmallArc: boolean, isCCW: boolean, dx: number, dy: number): this;
    arcToTangent(x1: number, y1: number, x2: number, y2: number, radius: number): this;
    setFillType(fill: FillType): this;
    setIsVolatile(_volatile: boolean): this;
    offset(dx: number, dy: number): this;
    transform(m: InputMatrix): this;
    makeAsWinding(): this | null;
    simplify(): boolean;
    op(path: SkPath, op: PathOp): boolean;
    dash(on: number, off: number, phase: number): boolean;
    stroke(opts?: StrokeOpts): this | null;
    trim(start: number, stop: number, isComplement: boolean): this | null;
    countPoints(): number;
    computeTightBounds(): SkRect;
    contains(x: number, y: number): boolean;
    copy(): JsiSkPath;
    equals(other: SkPath): boolean;
    getBounds(): JsiSkRect;
    getFillType(): FillType;
    getPoint(index: number): SkPoint;
    isEmpty(): boolean;
    isVolatile(): boolean;
    getLastPt(): {
        x: number;
        y: number;
    };
    toSVGString(): string;
    isInterpolatable(path2: SkPath): boolean;
    interpolate(end: SkPath, weight: number, output?: SkPath): SkPath | null;
    toCmds(): PathCommand[];
}
