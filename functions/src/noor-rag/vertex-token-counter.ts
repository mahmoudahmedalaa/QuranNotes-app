import type { TokenCounter } from './corpus';

export interface VertexComputeTokensContent {
    role: 'user';
    parts: [{ text: string }];
}

export interface VertexComputeTokensRequest {
    model: string;
    contents: VertexComputeTokensContent[];
    config: { abortSignal: AbortSignal };
}

export interface VertexComputeTokensResponse {
    tokensInfo?: Array<{ tokenIds?: string[] }>;
}

export interface VertexComputeTokensClient {
    models: {
        computeTokens(request: VertexComputeTokensRequest): Promise<VertexComputeTokensResponse>;
    };
}

export interface VertexBatchTokenCounterOptions {
    batchSize: number;
    concurrency: number;
    timeoutMs: number;
    retryDelayMs?: number;
}

interface PendingCount {
    text: string;
    resolve(value: number): void;
    reject(reason: unknown): void;
}

const MAX_RETRIES = 2;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function errorStatus(error: unknown): number | undefined {
    if (!isRecord(error)) {
        return undefined;
    }
    for (const key of ['status', 'statusCode', 'code'] as const) {
        const value = error[key];
        if (typeof value === 'number' && Number.isInteger(value)) {
            return value;
        }
    }
    return undefined;
}

function isTransient(error: unknown): boolean {
    const status = errorStatus(error);
    return status === 429 || (status !== undefined && status >= 500 && status <= 599);
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function requestWithTimeout(
    client: VertexComputeTokensClient,
    model: string,
    texts: readonly string[],
    timeoutMs: number,
): Promise<VertexComputeTokensResponse> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Vertex computeTokens timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([
            client.models.computeTokens({
                model,
                contents: texts.map(text => ({ role: 'user', parts: [{ text }] })),
                config: { abortSignal: controller.signal },
            }),
            timeout,
        ]);
    } finally {
        if (timer !== undefined) {
            clearTimeout(timer);
        }
    }
}

async function computeBatch(
    client: VertexComputeTokensClient,
    model: string,
    texts: readonly string[],
    timeoutMs: number,
    retryDelayMs: number,
): Promise<number[]> {
    let response: VertexComputeTokensResponse | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            response = await requestWithTimeout(client, model, texts, timeoutMs);
            break;
        } catch (error: unknown) {
            if (attempt === MAX_RETRIES || !isTransient(error)) {
                throw error;
            }
            await delay(retryDelayMs * (attempt + 1));
        }
    }
    if (!response || !Array.isArray(response.tokensInfo)
        || response.tokensInfo.length !== texts.length) {
        throw new Error('Vertex computeTokens returned invalid response cardinality');
    }
    return response.tokensInfo.map((info, index) => {
        if (!Array.isArray(info.tokenIds) || !info.tokenIds.every(tokenId => typeof tokenId === 'string')) {
            throw new Error(`Vertex computeTokens returned invalid token info at index ${index}`);
        }
        const count = info.tokenIds.length;
        if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0) {
            throw new Error(`Vertex computeTokens returned invalid token count at index ${index}`);
        }
        return count;
    });
}

export function createVertexBatchTokenCounter(
    client: VertexComputeTokensClient,
    model: string,
    options: VertexBatchTokenCounterOptions,
): TokenCounter {
    if (!model || !Number.isInteger(options.batchSize) || options.batchSize < 1
        || !Number.isInteger(options.concurrency) || options.concurrency < 1
        || !Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0
        || (options.retryDelayMs !== undefined
            && (!Number.isFinite(options.retryDelayMs) || options.retryDelayMs < 0))) {
        throw new Error('Invalid Vertex batch token counter configuration');
    }
    const queue: PendingCount[] = [];
    const retryDelayMs = options.retryDelayMs ?? 250;
    let activeBatches = 0;
    let drainScheduled = false;

    const scheduleDrain = (): void => {
        if (drainScheduled) {
            return;
        }
        drainScheduled = true;
        queueMicrotask(() => {
            drainScheduled = false;
            drain();
        });
    };
    const runBatch = async (batch: PendingCount[]): Promise<void> => {
        try {
            const counts = await computeBatch(
                client,
                model,
                batch.map(item => item.text),
                options.timeoutMs,
                retryDelayMs,
            );
            batch.forEach((item, index) => item.resolve(counts[index]!));
        } catch (error: unknown) {
            batch.forEach(item => item.reject(error));
        } finally {
            activeBatches -= 1;
            scheduleDrain();
        }
    };
    const drain = (): void => {
        while (activeBatches < options.concurrency && queue.length > 0) {
            const batch = queue.splice(0, options.batchSize);
            activeBatches += 1;
            void runBatch(batch);
        }
    };

    return {
        mode: 'vertex-production',
        model,
        countTokens: (text: string): Promise<number> => new Promise((resolve, reject) => {
            queue.push({ text, resolve, reject });
            scheduleDrain();
        }),
    };
}
