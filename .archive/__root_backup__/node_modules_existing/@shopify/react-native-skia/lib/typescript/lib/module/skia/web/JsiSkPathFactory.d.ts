export class JsiSkPathFactory extends Host {
    Make(): JsiSkPath;
    MakeFromSVGString(str: any): JsiSkPath | null;
    MakeFromOp(one: any, two: any, op: any): JsiSkPath | null;
    MakeFromCmds(cmds: any): JsiSkPath | null;
    MakeFromText(_text: any, _x: any, _y: any, _font: any): jest.Mock<any, any, any>;
    Rect(rect: any, isCCW: any): JsiSkPath;
    Oval(rect: any, isCCW: any, startIndex: any): JsiSkPath;
    Circle(x: any, y: any, r: any): JsiSkPath;
    RRect(rrect: any, isCCW: any): JsiSkPath;
    Line(p1: any, p2: any): JsiSkPath;
    Polygon(points: any, close: any): JsiSkPath;
    Stroke(srcPath: any, opts: any): JsiSkPath | null;
    Trim(srcPath: any, start: any, end: any, isComplement: any): JsiSkPath | null;
    Simplify(srcPath: any): JsiSkPath | null;
    Dash(srcPath: any, on: any, off: any, phase: any): JsiSkPath | null;
    AsWinding(srcPath: any): JsiSkPath | null;
    Interpolate(start: any, end: any, weight: any): JsiSkPath | null;
}
import { Host } from "./Host";
import { JsiSkPath } from "./JsiSkPath";
