"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Toolbar = Toolbar;
exports.toolbarStyles = void 0;
var _reactNative = require("react-native");
var _useBridgeState = require("../useBridgeState");
var _react = _interopRequireDefault(require("react"));
var _actions = require("./actions");
var _EditLinkBar = require("./EditLinkBar");
var _utils = require("../../utils");
var _ToolbarItemComp = require("./ToolbarItemComp");
var _WebToolbar = require("./WebToolbar");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
const toolbarStyles = exports.toolbarStyles = _reactNative.StyleSheet.create({});
function Toolbar({
  editor,
  hidden = undefined,
  items = _actions.DEFAULT_TOOLBAR_ITEMS,
  shouldHideDisabledToolbarItems = false
}) {
  const editorState = (0, _useBridgeState.useBridgeState)(editor);
  const {
    isKeyboardUp
  } = (0, _utils.useKeyboard)();
  const [toolbarContext, setToolbarContext] = _react.default.useState(_actions.ToolbarContext.Main);
  const hideToolbar = hidden === undefined ? !isKeyboardUp || !editorState.isFocused : hidden;
  const args = {
    editor,
    editorState,
    setToolbarContext,
    toolbarContext
  };
  const filteredItems = shouldHideDisabledToolbarItems ? items.filter(item => !item.disabled(args)) : items;
  switch (toolbarContext) {
    case _actions.ToolbarContext.Main:
    case _actions.ToolbarContext.Heading:
      if (_reactNative.Platform.OS === 'web') {
        return /*#__PURE__*/_react.default.createElement(_WebToolbar.WebToolbar, {
          items: toolbarContext === _actions.ToolbarContext.Main ? filteredItems : _actions.HEADING_ITEMS,
          args: args,
          editor: editor,
          hidden: hidden
        });
      }
      return /*#__PURE__*/_react.default.createElement(_reactNative.FlatList, {
        data: toolbarContext === _actions.ToolbarContext.Main ? filteredItems : _actions.HEADING_ITEMS,
        style: [editor.theme.toolbar.toolbarBody, hideToolbar ? editor.theme.toolbar.hidden : undefined],
        renderItem: ({
          item
        }) => {
          return /*#__PURE__*/_react.default.createElement(_ToolbarItemComp.ToolbarItemComp, _extends({}, item, {
            args: args,
            editor: editor
          }));
        },
        horizontal: true
      });
    case _actions.ToolbarContext.Link:
      return /*#__PURE__*/_react.default.createElement(_EditLinkBar.EditLinkBar, {
        theme: editor.theme,
        initialLink: editorState.activeLink,
        onBlur: () => {
          if (_reactNative.Platform.OS === 'web') {
            // On web blur is called before onEditLink. This isn't an ideal fix however this is going to be change soon when we
            // add the new api for toolbar where we will have more control. This is a temporary fix for now.
            setTimeout(() => {
              setToolbarContext(_actions.ToolbarContext.Main);
            }, 100);
          } else {
            setToolbarContext(_actions.ToolbarContext.Main);
          }
        },
        onLinkIconClick: () => {
          setToolbarContext(_actions.ToolbarContext.Main);
          editor.focus();
        },
        onEditLink: link => {
          editor.setLink(link);
          editor.focus();
          if (_reactNative.Platform.OS === 'android') {
            // On android we dont want to hide the link input before we finished focus on editor
            // Add here 100ms and we can try to find better solution later
            setTimeout(() => {
              setToolbarContext(_actions.ToolbarContext.Main);
            }, 100);
          } else {
            setToolbarContext(_actions.ToolbarContext.Main);
          }
        }
      });
  }
}
//# sourceMappingURL=Toolbar.js.map