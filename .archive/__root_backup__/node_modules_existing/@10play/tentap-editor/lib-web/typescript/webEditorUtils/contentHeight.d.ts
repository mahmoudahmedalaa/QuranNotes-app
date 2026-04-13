declare class ContentHeightListener {
    connected: boolean;
    private resizeObserver;
    private currentHeight;
    connect(element: Element, cb: (height: number) => void): void;
    disconnect(): void;
    get height(): number | null;
}
export declare const contentHeightListener: ContentHeightListener | {
    height: number;
    connect: () => void;
    connected: boolean;
};
export {};
