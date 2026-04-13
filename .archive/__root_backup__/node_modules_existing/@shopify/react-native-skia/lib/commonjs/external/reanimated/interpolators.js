"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useVectorInterpolation = exports.usePathValue = exports.usePathInterpolation = exports.useClock = exports.notifyChange = void 0;
var _react = require("react");
var _animation = require("../../animation");
var _skia = require("../../skia");
var _Offscreen = require("../../renderer/Offscreen");
var _ReanimatedProxy = _interopRequireDefault(require("./ReanimatedProxy"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const notifyChange = value => {
  "worklet";

  if ((0, _Offscreen.isOnMainThread)()) {
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
exports.notifyChange = notifyChange;
const usePathValue = (cb, init, transform) => {
  const builderInit = (0, _react.useMemo)(() => _skia.Skia.PathBuilder.Make(), []);
  const pathInit = (0, _react.useMemo)(() => _skia.Skia.Path.Make(), []);
  const builder = _ReanimatedProxy.default.useSharedValue(builderInit);
  const path = _ReanimatedProxy.default.useSharedValue(pathInit);
  _ReanimatedProxy.default.useDerivedValue(() => {
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
exports.usePathValue = usePathValue;
const useClock = () => {
  const clock = _ReanimatedProxy.default.useSharedValue(0);
  const callback = (0, _react.useCallback)(info => {
    "worklet";

    clock.value = info.timeSinceFirstFrame;
  }, [clock]);
  _ReanimatedProxy.default.useFrameCallback(callback);
  return clock;
};

/**
 * @worklet
 */
exports.useClock = useClock;
const useInterpolator = (factory, value, interpolator, input, output, options) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const init = (0, _react.useMemo)(() => factory(), []);
  const result = _ReanimatedProxy.default.useSharedValue(init);
  _ReanimatedProxy.default.useAnimatedReaction(() => value.value, val => {
    result.value = interpolator(val, input, output, options, result.value);
    notifyChange(result);
  }, [input, output, options]);
  return result;
};
const usePathInterpolation = (value, input, outputRange, options) => {
  // Check if all paths in outputRange are interpolable
  const allPathsInterpolable = outputRange.slice(1).every(path => outputRange[0].isInterpolatable(path));
  if (!allPathsInterpolable) {
    // Handle the case where not all paths are interpolable
    // For example, throw an error or return early
    throw new Error(`Not all paths in the output range are interpolable.
See: https://shopify.github.io/react-native-skia/docs/animations/hooks#usepathinterpolation`);
  }
  return useInterpolator(() => _skia.Skia.Path.Make(), value, _animation.interpolatePaths, input, outputRange, options);
};
exports.usePathInterpolation = usePathInterpolation;
const useVectorInterpolation = (value, input, outputRange, options) => useInterpolator(() => _skia.Skia.Point(0, 0), value, _animation.interpolateVector, input, outputRange, options);
exports.useVectorInterpolation = useVectorInterpolation;
//# sourceMappingURL=interpolators.js.map