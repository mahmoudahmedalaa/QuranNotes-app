// For some reason on expo, this file is parsed on native, and then we get an error
import { isExpo } from '../utils/misc';
class ContentHeightListener {
  connected = false;
  resizeObserver = null;
  currentHeight = null;
  connect(element, cb) {
    this.connected = true;
    this.currentHeight = element.getBoundingClientRect().height;
    cb(this.currentHeight);
    this.resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const newHeight = entry.target.getBoundingClientRect().height;
        if (this.currentHeight !== newHeight) {
          this.currentHeight = newHeight;
          cb(newHeight);
        }
      }
    });
    this.resizeObserver.observe(element);
  }
  disconnect() {
    var _this$resizeObserver;
    (_this$resizeObserver = this.resizeObserver) === null || _this$resizeObserver === void 0 || _this$resizeObserver.disconnect();
  }
  get height() {
    return this.currentHeight;
  }
}

// when bundling because "document" does not exist. This is a hack to "shim" focusListener on expo
const shimmedHeightListener = {
  height: 0,
  connect: () => {},
  connected: true
};
export const contentHeightListener = isExpo() ? shimmedHeightListener : new ContentHeightListener();
//# sourceMappingURL=contentHeight.js.map