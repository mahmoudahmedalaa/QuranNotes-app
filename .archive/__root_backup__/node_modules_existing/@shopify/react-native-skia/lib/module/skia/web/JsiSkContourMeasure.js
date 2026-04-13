import { HostObject } from "./Host";
import { JsiSkPath } from "./JsiSkPath";
import { JsiSkPoint } from "./JsiSkPoint";
export class JsiSkContourMeasure extends HostObject {
  constructor(CanvasKit, ref) {
    super(CanvasKit, ref, "ContourMeasure");
  }
  getPosTan(distance) {
    const posTan = this.ref.getPosTan(distance);
    return [new JsiSkPoint(this.CanvasKit, posTan.slice(0, 2)), new JsiSkPoint(this.CanvasKit, posTan.slice(2))];
  }
  getSegment(startD, stopD, startWithMoveTo) {
    const segment = this.ref.getSegment(startD, stopD, startWithMoveTo);
    const builder = new this.CanvasKit.PathBuilder(segment);
    segment.delete();
    return new JsiSkPath(this.CanvasKit, builder);
  }
  isClosed() {
    return this.ref.isClosed();
  }
  length() {
    return this.ref.length();
  }
}
//# sourceMappingURL=JsiSkContourMeasure.js.map