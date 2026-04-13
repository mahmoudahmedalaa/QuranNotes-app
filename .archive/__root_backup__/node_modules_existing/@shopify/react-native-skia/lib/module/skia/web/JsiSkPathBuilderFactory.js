import { Host } from "./Host";
import { JsiSkPath } from "./JsiSkPath";
import { JsiSkPathBuilder } from "./JsiSkPathBuilder";
export class JsiSkPathBuilderFactory extends Host {
  constructor(CanvasKit) {
    super(CanvasKit);
  }
  Make() {
    return new JsiSkPathBuilder(this.CanvasKit, new this.CanvasKit.PathBuilder());
  }
  MakeFromPath(path) {
    const srcBuilder = JsiSkPath.fromValue(path);
    const srcPath = srcBuilder.snapshot();
    const builder = new this.CanvasKit.PathBuilder(srcPath);
    srcPath.delete();
    return new JsiSkPathBuilder(this.CanvasKit, builder);
  }
}
//# sourceMappingURL=JsiSkPathBuilderFactory.js.map