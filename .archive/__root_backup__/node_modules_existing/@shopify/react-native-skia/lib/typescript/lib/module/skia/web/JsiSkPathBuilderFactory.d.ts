export class JsiSkPathBuilderFactory extends Host {
    Make(): JsiSkPathBuilder;
    MakeFromPath(path: any): JsiSkPathBuilder;
}
import { Host } from "./Host";
import { JsiSkPathBuilder } from "./JsiSkPathBuilder";
