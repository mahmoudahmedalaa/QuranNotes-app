declare class AsyncMessages {
    subscriptions: {
        [key: string]: Function[];
    };
    constructor();
    onMessage(id: string, value: any): void;
    addListener(key: string, callback: Function): void;
    sendAsyncMessage<T>(message: any, postMessage: any): Promise<T>;
}
export declare const asyncMessages: AsyncMessages;
export {};
//# sourceMappingURL=AsyncMessages.d.ts.map