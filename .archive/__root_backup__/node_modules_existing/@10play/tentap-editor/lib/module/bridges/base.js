class BridgeExtension {
  constructor({
    forceName,
    tiptapExtension,
    tiptapExtensionDeps,
    onBridgeMessage,
    onEditorMessage,
    extendEditorState,
    extendEditorInstance,
    extendCSS,
    config,
    extendConfig
  }) {
    if (!tiptapExtension) {
      this.name = forceName || 'BridgeExtension';
    } else {
      this.name = Array.isArray(tiptapExtension) ? tiptapExtension.map(e => e.name).join('+') : tiptapExtension.name;
    }
    this.tiptapExtension = tiptapExtension;
    this.tiptapExtensionDeps = tiptapExtensionDeps;
    this.onBridgeMessage = onBridgeMessage;
    this.onEditorMessage = onEditorMessage;
    this.extendEditorState = extendEditorState;
    this.extendEditorInstance = extendEditorInstance;
    this.extendCSS = extendCSS;
    this.config = config;
    this.extendConfig = extendConfig;
  }

  // we can use clone, so that extension's can be configures without modifying
  // the values for each extension
  clone() {
    return new BridgeExtension({
      ...this,
      forceName: this.name
    });
  }

  // runs on native
  configureExtension(config) {
    const cloned = this.clone();
    cloned.config = config;
    return cloned;
  }
  configureCSS(css) {
    const cloned = this.clone();
    cloned.extendCSS = css;
    return cloned;
  }
  extendExtension(config) {
    const cloned = this.clone();
    cloned.extendConfig = config;
    return cloned;
  }

  // runs on web
  configureTiptapExtensionsOnRunTime(config, extendConfig) {
    // Configure extension
    if (this.tiptapExtension) {
      if (config) {
        var _this$tiptapExtension;
        this.tiptapExtension = (_this$tiptapExtension = this.tiptapExtension) === null || _this$tiptapExtension === void 0 ? void 0 : _this$tiptapExtension.configure(config);
      }
      if (extendConfig) {
        var _this$tiptapExtension2;
        this.tiptapExtension = (_this$tiptapExtension2 = this.tiptapExtension) === null || _this$tiptapExtension2 === void 0 ? void 0 : _this$tiptapExtension2.extend(extendConfig);
      }
    }
    return [this.tiptapExtension, ...(this.tiptapExtensionDeps || [])];
  }
}
export default BridgeExtension;
//# sourceMappingURL=base.js.map