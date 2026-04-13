export const __esModule: boolean;
export class JsiSkPathFactory extends _Host.Host {
    Make(): _JsiSkPath.JsiSkPath;
    MakeFromSVGString(str: any): _JsiSkPath.JsiSkPath | null;
    MakeFromOp(one: any, two: any, op: any): _JsiSkPath.JsiSkPath | null;
    MakeFromCmds(cmds: any): _JsiSkPath.JsiSkPath | null;
    MakeFromText(_text: any, _x: any, _y: any, _font: any): jest.Mock<any, any, any>;
    Rect(rect: any, isCCW: any): _JsiSkPath.JsiSkPath;
    Oval(rect: any, isCCW: any, startIndex: any): _JsiSkPath.JsiSkPath;
    Circle(x: any, y: any, r: any): _JsiSkPath.JsiSkPath;
    RRect(rrect: any, isCCW: any): _JsiSkPath.JsiSkPath;
    Line(p1: any, p2: any): _JsiSkPath.JsiSkPath;
    Polygon(points: any, close: any): _JsiSkPath.JsiSkPath;
    Stroke(srcPath: any, opts: any): _JsiSkPath.JsiSkPath | null;
    Trim(srcPath: any, start: any, end: any, isComplement: any): _JsiSkPath.JsiSkPath | null;
    Simplify(srcPath: any): _JsiSkPath.JsiSkPath | null;
    Dash(srcPath: any, on: any, off: any, phase: any): _JsiSkPath.JsiSkPath | null;
    AsWinding(srcPath: any): _JsiSkPath.JsiSkPath | null;
    Interpolate(start: any, end: any, weight: any): _JsiSkPath.JsiSkPath | null;
}
import _Host = require("./Host");
import _JsiSkPath = require("./JsiSkPath");
