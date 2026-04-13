import type { CanvasKit } from "canvaskit-wasm";
import type { PathBuilderFactory, SkPath } from "../types";
import { Host } from "./Host";
import { JsiSkPathBuilder } from "./JsiSkPathBuilder";
export declare class JsiSkPathBuilderFactory extends Host implements PathBuilderFactory {
    constructor(CanvasKit: CanvasKit);
    Make(): JsiSkPathBuilder;
    MakeFromPath(path: SkPath): JsiSkPathBuilder;
}
