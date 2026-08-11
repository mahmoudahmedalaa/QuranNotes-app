import type { NoorSource } from './generatedContract';

export * from './generatedContract';

export interface TafsirUnit {
    canonicalUnitId: string;
    source: NoorSource;
    sourceTitle: 'Tafsir Ibn Kathir' | "Tafsir Al-Sa'di";
    language: 'en' | 'ar';
    surah: number;
    verseStart: number;
    verseEnd: number;
    originalText: string;
    retrievalText: string;
    corpusVersion: string;
    contentHash: string;
    resourceId: number;
    upstreamReference: string;
    editionLabel: string;
    normalizationVersion: string;
    embeddingModel: string;
    embeddingDimension: number;
}

export interface TafsirChunk {
    chunkId: string;
    canonicalUnitId: string;
    chunkIndex: number;
    source: NoorSource;
    sourceTitle: string;
    language: 'en' | 'ar';
    surah: number;
    verseStart: number;
    verseEnd: number;
    originalStart: number;
    originalEnd: number;
    originalText: string;
    retrievalText: string;
    corpusVersion: string;
    contentHash: string;
    tokenCount: number;
    embeddingModel: string;
    embeddingDimension: number;
    embedding?: number[];
}

export interface ExactRetrievedEvidence {
    kind: 'exact';
    promptSourceId: string;
    chunk: TafsirChunk;
}

export interface SemanticRetrievedEvidence {
    kind: 'semantic';
    promptSourceId: string;
    chunk: TafsirChunk;
    similarity: number;
}

export type RetrievedEvidence = ExactRetrievedEvidence | SemanticRetrievedEvidence;
