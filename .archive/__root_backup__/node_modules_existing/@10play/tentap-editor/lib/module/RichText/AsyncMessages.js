class AsyncMessages {
  subscriptions = {};
  constructor() {
    this.subscriptions = {};
  }
  onMessage(id, value) {
    if (this.subscriptions[id]) {
      this.subscriptions[id].forEach(callback => {
        callback(value);
      });
    }
  }
  addListener(key, callback) {
    if (!this.subscriptions[key]) {
      this.subscriptions[key] = [];
    }
    this.subscriptions[key].push(callback);
  }
  sendAsyncMessage(message, postMessage) {
    const messageId = Math.random().toString(36).substring(7);
    message.payload = message.payload || {};
    message.payload.messageId = messageId;
    return new Promise(resolve => {
      this.addListener(messageId, resolve);
      postMessage(message);
    });
  }
}
export const asyncMessages = new AsyncMessages();
//# sourceMappingURL=AsyncMessages.js.map