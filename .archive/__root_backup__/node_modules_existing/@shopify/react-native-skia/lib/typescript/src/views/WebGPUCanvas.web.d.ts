import React from "react";
import type { ViewProps } from "react-native";
export interface NativeCanvas {
    surface: bigint;
    width: number;
    height: number;
    clientWidth: number;
    clientHeight: number;
}
export type RNCanvasContext = GPUCanvasContext & {
    present: () => void;
};
export interface WebGPUCanvasRef {
    getContextId: () => number;
    getContext(contextName: "webgpu"): RNCanvasContext | null;
    getNativeSurface: () => NativeCanvas;
}
interface WebGPUCanvasProps extends ViewProps {
    transparent?: boolean;
    ref?: React.Ref<WebGPUCanvasRef>;
}
export declare const WebGPUCanvas: ({ transparent: _transparent, ref: _ref, ...props }: WebGPUCanvasProps) => React.JSX.Element;
export {};
