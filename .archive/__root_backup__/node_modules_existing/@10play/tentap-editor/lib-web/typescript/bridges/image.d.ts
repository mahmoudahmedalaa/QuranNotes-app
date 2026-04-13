import BridgeExtension from './base';
type ImageEditorState = {};
type ImageEditorInstance = {
    setImage: (src: string) => void;
};
declare module '../types/EditorBridge' {
    interface BridgeState extends ImageEditorState {
    }
    interface EditorBridge extends ImageEditorInstance {
    }
}
export declare enum ImageEditorActionType {
    SetImage = "set-image"
}
type ImageMessage = {
    type: ImageEditorActionType.SetImage;
    payload: string;
};
export declare const ImageBridge: BridgeExtension<ImageEditorState, ImageEditorInstance, ImageMessage>;
export {};
