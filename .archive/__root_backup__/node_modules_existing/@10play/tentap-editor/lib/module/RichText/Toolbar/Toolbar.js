function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
import { FlatList, StyleSheet, Platform } from 'react-native';
import { useBridgeState } from '../useBridgeState';
import React from 'react';
import { DEFAULT_TOOLBAR_ITEMS, HEADING_ITEMS, ToolbarContext } from './actions';
import { EditLinkBar } from './EditLinkBar';
import { useKeyboard } from '../../utils';
import { ToolbarItemComp } from './ToolbarItemComp';
import { WebToolbar } from './WebToolbar';
export const toolbarStyles = StyleSheet.create({});
export function Toolbar({
  editor,
  hidden = undefined,
  items = DEFAULT_TOOLBAR_ITEMS,
  shouldHideDisabledToolbarItems = false
}) {
  const editorState = useBridgeState(editor);
  const {
    isKeyboardUp
  } = useKeyboard();
  const [toolbarContext, setToolbarContext] = React.useState(ToolbarContext.Main);
  const hideToolbar = hidden === undefined ? !isKeyboardUp || !editorState.isFocused : hidden;
  const args = {
    editor,
    editorState,
    setToolbarContext,
    toolbarContext
  };
  const filteredItems = shouldHideDisabledToolbarItems ? items.filter(item => !item.disabled(args)) : items;
  switch (toolbarContext) {
    case ToolbarContext.Main:
    case ToolbarContext.Heading:
      if (Platform.OS === 'web') {
        return /*#__PURE__*/React.createElement(WebToolbar, {
          items: toolbarContext === ToolbarContext.Main ? filteredItems : HEADING_ITEMS,
          args: args,
          editor: editor,
          hidden: hidden
        });
      }
      return /*#__PURE__*/React.createElement(FlatList, {
        data: toolbarContext === ToolbarContext.Main ? filteredItems : HEADING_ITEMS,
        style: [editor.theme.toolbar.toolbarBody, hideToolbar ? editor.theme.toolbar.hidden : undefined],
        renderItem: ({
          item
        }) => {
          return /*#__PURE__*/React.createElement(ToolbarItemComp, _extends({}, item, {
            args: args,
            editor: editor
          }));
        },
        horizontal: true
      });
    case ToolbarContext.Link:
      return /*#__PURE__*/React.createElement(EditLinkBar, {
        theme: editor.theme,
        initialLink: editorState.activeLink,
        onBlur: () => {
          if (Platform.OS === 'web') {
            // On web blur is called before onEditLink. This isn't an ideal fix however this is going to be change soon when we
            // add the new api for toolbar where we will have more control. This is a temporary fix for now.
            setTimeout(() => {
              setToolbarContext(ToolbarContext.Main);
            }, 100);
          } else {
            setToolbarContext(ToolbarContext.Main);
          }
        },
        onLinkIconClick: () => {
          setToolbarContext(ToolbarContext.Main);
          editor.focus();
        },
        onEditLink: link => {
          editor.setLink(link);
          editor.focus();
          if (Platform.OS === 'android') {
            // On android we dont want to hide the link input before we finished focus on editor
            // Add here 100ms and we can try to find better solution later
            setTimeout(() => {
              setToolbarContext(ToolbarContext.Main);
            }, 100);
          } else {
            setToolbarContext(ToolbarContext.Main);
          }
        }
      });
  }
}
//# sourceMappingURL=Toolbar.js.map