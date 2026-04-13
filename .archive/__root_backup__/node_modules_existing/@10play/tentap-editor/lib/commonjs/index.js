"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  BridgeExtension: true,
  Images: true,
  EditorHelper: true,
  editorHtml: true
};
Object.defineProperty(exports, "BridgeExtension", {
  enumerable: true,
  get: function () {
    return _base.default;
  }
});
Object.defineProperty(exports, "EditorHelper", {
  enumerable: true,
  get: function () {
    return _EditorHelper.EditorHelper;
  }
});
Object.defineProperty(exports, "Images", {
  enumerable: true,
  get: function () {
    return _assets.Images;
  }
});
Object.defineProperty(exports, "editorHtml", {
  enumerable: true,
  get: function () {
    return _editorHtml.editorHtml;
  }
});
var _RichText = require("./RichText");
Object.keys(_RichText).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _RichText[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _RichText[key];
    }
  });
});
var _base = _interopRequireDefault(require("./bridges/base"));
var _StarterKit = require("./bridges/StarterKit");
Object.keys(_StarterKit).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _StarterKit[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _StarterKit[key];
    }
  });
});
var _bold = require("./bridges/bold");
Object.keys(_bold).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _bold[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _bold[key];
    }
  });
});
var _italic = require("./bridges/italic");
Object.keys(_italic).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _italic[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _italic[key];
    }
  });
});
var _strike = require("./bridges/strike");
Object.keys(_strike).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _strike[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _strike[key];
    }
  });
});
var _history = require("./bridges/history");
Object.keys(_history).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _history[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _history[key];
    }
  });
});
var _orderedList = require("./bridges/orderedList");
Object.keys(_orderedList).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _orderedList[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _orderedList[key];
    }
  });
});
var _heading = require("./bridges/heading");
Object.keys(_heading).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _heading[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _heading[key];
    }
  });
});
var _br = require("./bridges/br");
Object.keys(_br).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _br[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _br[key];
    }
  });
});
var _bulletList = require("./bridges/bulletList");
Object.keys(_bulletList).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _bulletList[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _bulletList[key];
    }
  });
});
var _blockquote = require("./bridges/blockquote");
Object.keys(_blockquote).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _blockquote[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _blockquote[key];
    }
  });
});
var _listItem = require("./bridges/listItem");
Object.keys(_listItem).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _listItem[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _listItem[key];
    }
  });
});
var _code = require("./bridges/code");
Object.keys(_code).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _code[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _code[key];
    }
  });
});
var _dropcursor = require("./bridges/dropcursor");
Object.keys(_dropcursor).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _dropcursor[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _dropcursor[key];
    }
  });
});
var _underline = require("./bridges/underline");
Object.keys(_underline).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _underline[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _underline[key];
    }
  });
});
var _tasklist = require("./bridges/tasklist");
Object.keys(_tasklist).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _tasklist[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _tasklist[key];
    }
  });
});
var _link = require("./bridges/link");
Object.keys(_link).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _link[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _link[key];
    }
  });
});
var _color = require("./bridges/color");
Object.keys(_color).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _color[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _color[key];
    }
  });
});
var _highlight = require("./bridges/highlight");
Object.keys(_highlight).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _highlight[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _highlight[key];
    }
  });
});
var _placeholder = require("./bridges/placeholder");
Object.keys(_placeholder).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _placeholder[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _placeholder[key];
    }
  });
});
var _core = require("./bridges/core");
Object.keys(_core).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _core[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _core[key];
    }
  });
});
var _image = require("./bridges/image");
Object.keys(_image).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _image[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _image[key];
    }
  });
});
var _types = require("./types");
Object.keys(_types).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _types[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _types[key];
    }
  });
});
var _utils = require("./utils");
Object.keys(_utils).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _utils[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _utils[key];
    }
  });
});
var _assets = require("./assets");
var _EditorHelper = require("./RichText/EditorHelper");
var _editorHtml = require("./simpleWebEditor/build/editorHtml");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
//# sourceMappingURL=index.js.map