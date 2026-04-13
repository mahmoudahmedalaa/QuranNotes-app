import React from "react";
import type { ViewProps } from "react-native";
declare global {
    var RNWebGPU: {
        gpu: GPU;
        fabric: boolean;
        getNativeSurface: (contextId: number) => NativeCanvas;
        MakeWebGPUCanvasContext: (contextId: number, width: number, height: number) => RNCanvasContext;
    };
}
type SurfacePointer = bigint;
export interface NativeCanvas {
    surface: SurfacePointer;
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
export declare const WebGPUCanvas: ({ transparent, ref, ...props }: WebGPUCanvasProps) => React.JSX.Element;
export {};
