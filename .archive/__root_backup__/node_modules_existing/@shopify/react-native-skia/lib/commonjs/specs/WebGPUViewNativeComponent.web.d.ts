import React from "react";
import type { Int32 } from "react-native/Libraries/Types/CodegenTypes";
import type { ViewProps } from "react-native";
export interface NativeProps extends ViewProps {
    contextId: Int32;
    transparent: boolean;
}
export default function WebGPUViewNativeComponent(props: NativeProps): React.JSX.Element;
