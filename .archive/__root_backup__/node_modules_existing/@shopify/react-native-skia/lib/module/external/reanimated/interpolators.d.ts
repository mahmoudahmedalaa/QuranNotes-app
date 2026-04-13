import type { ExtrapolationType, SharedValue } from "react-native-reanimated";
import type { SkPath, SkPathBuilder, SkPoint } from "../../skia/types";
export declare const notifyChange: <T>(value: SharedValue<T>) => void;
/**
 * Hook for creating animated paths using PathBuilder.
 * The callback receives a mutable PathBuilder that can be used to construct the path.
 * The resulting immutable SkPath is stored in a shared value.
 *
 * @param cb - Callback that receives the PathBuilder to construct the path
 * @param init - Optional initial path to add to the builder
 * @param transform - Optional transform function applied to the built path
 */
export declare const usePathValue: (cb: (builder: SkPathBuilder) => void, init?: SkPath, transform?: (path: SkPath) => SkPath) => SharedValue<SkPath>;
export declare const useClock: () => SharedValue<number>;
export declare const usePathInterpolation: (value: SharedValue<number>, input: number[], outputRange: SkPath[], options?: ExtrapolationType) => SharedValue<SkPath>;
export declare const useVectorInterpolation: (value: SharedValue<number>, input: number[], outputRange: SkPoint[], options?: ExtrapolationType) => SharedValue<SkPoint>;
