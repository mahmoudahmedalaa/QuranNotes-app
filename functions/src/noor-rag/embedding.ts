export const EMBEDDING_MODEL = 'gemini-embedding-2' as const;
export const EMBEDDING_DIMENSION = 768 as const;
export const EMBEDDING_CONCURRENCY = 4 as const;

export interface Embedder {
    embed(text: string): Promise<readonly number[]>;
}

export interface VertexEmbeddingRequest {
    model: typeof EMBEDDING_MODEL;
    contents: string;
    config: {
        outputDimensionality: typeof EMBEDDING_DIMENSION;
    };
}

export interface VertexEmbeddingClient {
    embedContent(request: VertexEmbeddingRequest): Promise<{
        embeddings?: Array<{ values?: number[] }>;
    }>;
}

export type EmbeddingResult =
    | { ok: true; embedding: number[] }
    | { ok: false; error: string };

export function formatEmbeddingDocument(sourceTitle: string, retrievalText: string): string {
    return `title: ${sourceTitle} | text: ${retrievalText}`;
}

export function formatEmbeddingQuery(content: string): string {
    return `task: question answering | query: ${content}`;
}

export function createVertexEmbedder(client: VertexEmbeddingClient): Embedder {
    return {
        embed: async (text: string): Promise<readonly number[]> => {
            const response = await client.embedContent({
                model: EMBEDDING_MODEL,
                contents: text,
                config: { outputDimensionality: EMBEDDING_DIMENSION },
            });
            return response.embeddings?.[0]?.values ?? [];
        },
    };
}

export function validateEmbedding(value: readonly number[]): number[] {
    if (value.length !== EMBEDDING_DIMENSION) {
        throw new Error(`Embedding must contain exactly ${EMBEDDING_DIMENSION} values`);
    }
    if (!value.every(Number.isFinite)) {
        throw new Error('Embedding values must all be finite numbers');
    }
    return [...value];
}

export async function embedWithConcurrency(
    texts: readonly string[],
    embedder: Embedder,
    concurrency = EMBEDDING_CONCURRENCY,
): Promise<EmbeddingResult[]> {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > EMBEDDING_CONCURRENCY) {
        throw new Error(`Embedding concurrency must be between 1 and ${EMBEDDING_CONCURRENCY}`);
    }
    const results = new Array<EmbeddingResult>(texts.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
        while (nextIndex < texts.length) {
            const index = nextIndex;
            nextIndex += 1;
            const text = texts[index];
            if (typeof text !== 'string' || text.trim().length === 0) {
                results[index] = { ok: false, error: 'Embedding input must not be empty' };
                continue;
            }
            try {
                results[index] = { ok: true, embedding: validateEmbedding(await embedder.embed(text)) };
            } catch (error: unknown) {
                results[index] = {
                    ok: false,
                    error: error instanceof Error ? error.message : 'Unknown embedding failure',
                };
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
    return results;
}
