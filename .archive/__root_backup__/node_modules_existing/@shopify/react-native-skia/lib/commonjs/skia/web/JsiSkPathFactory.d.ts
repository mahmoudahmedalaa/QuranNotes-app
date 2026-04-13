import type { CanvasKit } from "canvaskit-wasm";
import type { InputRRect, PathCommand, PathOp, SkFont, SkPath, SkPoint, SkRect, StrokeOpts } from "../types";
import type { PathFactory } from "../types/Path/PathFactory";
import { Host } from "./Host";
import { JsiSkPath } from "./JsiSkPath";
export declare class JsiSkPathFactory extends Host implements PathFactory {
    constructor(CanvasKit: CanvasKit);
    Make(): JsiSkPath;
    MakeFromSVGString(str: string): JsiSkPath | null;
    MakeFromOp(one: SkPath, two: SkPath, op: PathOp): JsiSkPath | null;
    MakeFromCmds(cmds: PathCommand[]): JsiSkPath | null;
    MakeFromText(_text: string, _x: number, _y: number, _font: SkFont): SkPath;
    Rect(rect: SkRect, isCCW?: boolean): JsiSkPath;
    Oval(rect: SkRect, isCCW?: boolean, startIndex?: number): JsiSkPath;
    Circle(x: number, y: number, r: number): JsiSkPath;
    RRect(rrect: InputRRect, isCCW?: boolean): JsiSkPath;
    Line(p1: SkPoint, p2: SkPoint): JsiSkPath;
    Polygon(points: SkPoint[], close: boolean): JsiSkPath;
    Stroke(srcPath: SkPath, opts?: StrokeOpts): JsiSkPath | null;
    Trim(srcPath: SkPath, start: number, end: number, isComplement: boolean): JsiSkPath | null;
    Simplify(srcPath: SkPath): JsiSkPath | null;
    Dash(srcPath: SkPath, on: number, off: number, phase: number): JsiSkPath | null;
    AsWinding(srcPath: SkPath): JsiSkPath | null;
    Interpolate(start: SkPath, end: SkPath, weight: number): JsiSkPath | null;
}
