class BridgeExtension {
    constructor({ forceName, tiptapExtension, tiptapExtensionDeps, onBridgeMessage, onEditorMessage, extendEditorState, extendEditorInstance, extendCSS, config, extendConfig, }) {
        if (!tiptapExtension) {
            this.name = forceName || 'BridgeExtension';
        }
        else {
            this.name = Array.isArray(tiptapExtension)
                ? tiptapExtension.map((e) => e.name).join('+')
                : tiptapExtension.name;
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
        return new BridgeExtension(Object.assign(Object.assign({}, this), { forceName: this.name }));
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
        var _a, _b;
        // Configure extension
        if (this.tiptapExtension) {
            if (config) {
                this.tiptapExtension = (_a = this.tiptapExtension) === null || _a === void 0 ? void 0 : _a.configure(config);
            }
            if (extendConfig) {
                this.tiptapExtension = (_b = this.tiptapExtension) === null || _b === void 0 ? void 0 : _b.extend(extendConfig);
            }
        }
        return [this.tiptapExtension, ...(this.tiptapExtensionDeps || [])];
    }
}
export default BridgeExtension;
