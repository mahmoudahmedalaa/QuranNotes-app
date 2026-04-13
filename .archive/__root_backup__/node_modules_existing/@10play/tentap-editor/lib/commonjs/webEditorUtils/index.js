"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  BridgeExtension: true,
  BlockquoteBridge: true,
  BoldBridge: true,
  BulletListBridge: true,
  CodeBridge: true,
  ColorBridge: true,
  CoreBridge: true,
  HeadingBridge: true,
  HighlightBridge: true,
  blueBackgroundPlugin: true,
  HistoryBridge: true,
  ImageBridge: true,
  ItalicBridge: true,
  LinkBridge: true,
  ListItemBridge: true,
  OrderedListBridge: true,
  PlaceholderBridge: true,
  TenTapStartKit: true,
  StrikeBridge: true,
  TaskListBridge: true,
  UnderlineBridge: true,
  HardBreakBridge: true
};
Object.defineProperty(exports, "BlockquoteBridge", {
  enumerable: true,
  get: function () {
    return _blockquote.BlockquoteBridge;
  }
});
Object.defineProperty(exports, "BoldBridge", {
  enumerable: true,
  get: function () {
    return _bold.BoldBridge;
  }
});
Object.defineProperty(exports, "BridgeExtension", {
  enumerable: true,
  get: function () {
    return _base.default;
  }
});
Object.defineProperty(exports, "BulletListBridge", {
  enumerable: true,
  get: function () {
    return _bulletList.BulletListBridge;
  }
});
Object.defineProperty(exports, "CodeBridge", {
  enumerable: true,
  get: function () {
    return _code.CodeBridge;
  }
});
Object.defineProperty(exports, "ColorBridge", {
  enumerable: true,
  get: function () {
    return _color.ColorBridge;
  }
});
Object.defineProperty(exports, "CoreBridge", {
  enumerable: true,
  get: function () {
    return _core.CoreBridge;
  }
});
Object.defineProperty(exports, "HardBreakBridge", {
  enumerable: true,
  get: function () {
    return _br.HardBreakBridge;
  }
});
Object.defineProperty(exports, "HeadingBridge", {
  enumerable: true,
  get: function () {
    return _heading.HeadingBridge;
  }
});
Object.defineProperty(exports, "HighlightBridge", {
  enumerable: true,
  get: function () {
    return _highlight.HighlightBridge;
  }
});
Object.defineProperty(exports, "HistoryBridge", {
  enumerable: true,
  get: function () {
    return _history.HistoryBridge;
  }
});
Object.defineProperty(exports, "ImageBridge", {
  enumerable: true,
  get: function () {
    return _image.ImageBridge;
  }
});
Object.defineProperty(exports, "ItalicBridge", {
  enumerable: true,
  get: function () {
    return _italic.ItalicBridge;
  }
});
Object.defineProperty(exports, "LinkBridge", {
  enumerable: true,
  get: function () {
    return _link.LinkBridge;
  }
});
Object.defineProperty(exports, "ListItemBridge", {
  enumerable: true,
  get: function () {
    return _listItem.ListItemBridge;
  }
});
Object.defineProperty(exports, "OrderedListBridge", {
  enumerable: true,
  get: function () {
    return _orderedList.OrderedListBridge;
  }
});
Object.defineProperty(exports, "PlaceholderBridge", {
  enumerable: true,
  get: function () {
    return _placeholder.PlaceholderBridge;
  }
});
Object.defineProperty(exports, "StrikeBridge", {
  enumerable: true,
  get: function () {
    return _strike.StrikeBridge;
  }
});
Object.defineProperty(exports, "TaskListBridge", {
  enumerable: true,
  get: function () {
    return _tasklist.TaskListBridge;
  }
});
Object.defineProperty(exports, "TenTapStartKit", {
  enumerable: true,
  get: function () {
    return _StarterKit.TenTapStartKit;
  }
});
Object.defineProperty(exports, "UnderlineBridge", {
  enumerable: true,
  get: function () {
    return _underline.UnderlineBridge;
  }
});
Object.defineProperty(exports, "blueBackgroundPlugin", {
  enumerable: true,
  get: function () {
    return _HighlightSelection.blueBackgroundPlugin;
  }
});
var _useTenTap = require("./useTenTap");
Object.keys(_useTenTap).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _useTenTap[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _useTenTap[key];
    }
  });
});
var _base = _interopRequireDefault(require("../bridges/base"));
var _blockquote = require("../bridges/blockquote");
var _bold = require("../bridges/bold");
var _bulletList = require("../bridges/bulletList");
var _code = require("../bridges/code");
var _color = require("../bridges/color");
var _core = require("../bridges/core");
var _heading = require("../bridges/heading");
var _highlight = require("../bridges/highlight");
var _HighlightSelection = require("../bridges/HighlightSelection");
var _history = require("../bridges/history");
var _image = require("../bridges/image");
var _italic = require("../bridges/italic");
var _link = require("../bridges/link");
var _listItem = require("../bridges/listItem");
var _orderedList = require("../bridges/orderedList");
var _placeholder = require("../bridges/placeholder");
var _StarterKit = require("../bridges/StarterKit");
var _strike = require("../bridges/strike");
var _tasklist = require("../bridges/tasklist");
var _underline = require("../bridges/underline");
var _br = require("../bridges/br");
var _view = require("@tiptap/pm/view");
Object.keys(_view).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _view[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _view[key];
    }
  });
});
var _state = require("@tiptap/pm/state");
Object.keys(_state).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _state[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _state[key];
    }
  });
});
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map