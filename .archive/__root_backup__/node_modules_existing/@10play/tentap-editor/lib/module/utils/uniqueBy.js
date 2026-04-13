// Unique by, last wins
export function uniqueBy(items, keyOrFn) {
  const keyFn = typeof keyOrFn === 'function' ? keyOrFn : item => item[keyOrFn];
  const seen = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    seen.set(key, item);
  });
  return Array.from(seen.values());
}
//# sourceMappingURL=uniqueBy.js.map