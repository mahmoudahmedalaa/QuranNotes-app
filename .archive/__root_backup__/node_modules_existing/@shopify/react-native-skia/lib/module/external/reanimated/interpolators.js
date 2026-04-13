import { useCallback, useMemo } from "react";
import { interpolatePaths, interpolateVector } from "../../animation";
import { Skia } from "../../skia";
import { isOnMainThread } from "../../renderer/Offscreen";
import Rea from "./ReanimatedProxy";
export const notifyChange = value => {
  "worklet";

  if (isOnMainThread()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value._value = value.value;
  }
};

/**
 * Hook for creating animated paths using PathBuilder.
 * The callback receives a mutable PathBuilder that can be used to construct the path.
 * The resulting immutable SkPath is stored in a shared value.
 *
 * @param cb - Callback that receives the PathBuilder to construct the path
 * @param init - Optional initial path to add to the builder
 * @param transform - Optional transform function applied to the built path
 */
export const usePathValue = (cb, init, transform) => {
  const builderInit = useMemo(() => Skia.PathBuilder.Make(), []);
  const pathInit = useMemo(() => Skia.Path.Make(), []);
  const builder = Rea.useSharedValue(builderInit);
  const path = Rea.useSharedValue(pathInit);
  Rea.useDerivedValue(() => {
    builder.value.reset();
    if (init !== undefined) {
      builder.value.addPath(init);
    }
    cb(builder.value);
    let result = builder.value.build();
    if (transform !== undefined) {
      result = transform(result);
    }
    path.value = result;
    notifyChange(path);
  });
  return path;
};
export const useClock = () => {
  const clock = Rea.useSharedValue(0);
  const callback = useCallback(info => {
    "worklet";

    clock.value = info.timeSinceFirstFrame;
  }, [clock]);
  Rea.useFrameCallback(callback);
  return clock;
};

/**
 * @worklet
 */

const useInterpolator = (factory, value, interpolator, input, output, options) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const init = useMemo(() => factory(), []);
  const result = Rea.useSharedValue(init);
  Rea.useAnimatedReaction(() => value.value, val => {
    result.value = interpolator(val, input, output, options, result.value);
    notifyChange(result);
  }, [input, output, options]);
  return result;
};
export const usePathInterpolation = (value, input, outputRange, options) => {
  // Check if all paths in outputRange are interpolable
  const allPathsInterpolable = outputRange.slice(1).every(path => outputRange[0].isInterpolatable(path));
  if (!allPathsInterpolable) {
    // Handle the case where not all paths are interpolable
    // For example, throw an error or return early
    throw new Error(`Not all paths in the output range are interpolable.
See: https://shopify.github.io/react-native-skia/docs/animations/hooks#usepathinterpolation`);
  }
  return useInterpolator(() => Skia.Path.Make(), value, interpolatePaths, input, outputRange, options);
};
export const useVectorInterpolation = (value, input, outputRange, options) => useInterpolator(() => Skia.Point(0, 0), value, interpolateVector, input, outputRange, options);
//# sourceMappingURL=interpolators.js.map