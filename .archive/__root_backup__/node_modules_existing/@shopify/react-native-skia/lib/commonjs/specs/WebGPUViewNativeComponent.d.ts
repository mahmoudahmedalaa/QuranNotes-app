import type { ViewProps } from "react-native";
import type { Int32 } from "react-native/Libraries/Types/CodegenTypes";
export interface NativeProps extends ViewProps {
    contextId: Int32;
    transparent: boolean;
}
declare const _default: import("react-native").HostComponent<NativeProps>;
export default _default;
