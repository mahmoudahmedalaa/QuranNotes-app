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
    originalCharacterStart: number;
    originalCharacterEnd: number;
    originalText: string;
    retrievalText: string;
    corpusVersion: string;
    contentHash: string;
    embeddingModel: string;
    embeddingDimension: number;
    embedding: number[];
}

export interface RetrievedEvidence {
    promptSourceId: string;
    chunk: TafsirChunk;
    similarity: number;
}
