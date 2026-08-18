import type { RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

interface ReplayEvidenceInput {
    chunkId: string;
    canonicalUnitId: string;
    retrievalText: string;
    surah: number;
    verseStart: number;
    verseEnd: number;
    similarity: number;
}

function replayEvidence(input: ReplayEvidenceInput): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: input.chunkId,
        canonicalUnitId: input.canonicalUnitId,
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah: input.surah,
        verseStart: input.verseStart,
        verseEnd: input.verseEnd,
        originalStart: 0,
        originalEnd: input.retrievalText.length,
        originalText: input.retrievalText,
        retrievalText: input.retrievalText,
        corpusVersion: '2026-08-10-v1',
        contentHash: `fixture-${input.chunkId}`,
        tokenCount: input.retrievalText.split(/\s+/u).length,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return {
        kind: 'semantic',
        promptSourceId: 'S1',
        chunk,
        similarity: input.similarity,
    };
}

export const NOAH_PRODUCTION_REPLAY = replayEvidence({
    chunkId: 'c_0ad0b17c1dc61edfe7924318e1cb73dfeaf1c32415783dde9fe71b99bba1f8e4_000_e29e57df16f7',
    canonicalUnitId: 'u_0ad0b17c1dc61edfe7924318e1cb73dfeaf1c32415783dde9fe71b99bba1f8e4',
    retrievalText: 'Nuh and His People. Allah tells us about the story of Nuh and the rejection of his people.',
    surah: 7,
    verseStart: 59,
    verseEnd: 64,
    similarity: 0.7774966340151523,
});

export const RIBA_PRODUCTION_REPLAY = replayEvidence({
    chunkId: 'c_3e82d7e6606c4f68383c9a038f58da1b418018fcbc9409974167a44bef94399c_000_0d9fa6c980d6',
    canonicalUnitId: 'u_3e82d7e6606c4f68383c9a038f58da1b418018fcbc9409974167a44bef94399c',
    retrievalText: 'The prohibition of riba and the distinction between lawful trade and interest are explained here.',
    surah: 2,
    verseStart: 275,
    verseEnd: 279,
    similarity: 0.812,
});

export const BAQARAH_VIRTUES_PRODUCTION_REPLAY = replayEvidence({
    chunkId: 'c_4bf4f3f0cf5d6a2c2b05debd600e5533150ce9f4aa8540578f09bfc493d15e11_000_58fe037abefb',
    canonicalUnitId: 'u_4bf4f3f0cf5d6a2c2b05debd600e5533150ce9f4aa8540578f09bfc493d15e11',
    retrievalText: 'Virtues of Surat Al-Baqarah are discussed in this section.',
    surah: 2,
    verseStart: 1,
    verseEnd: 1,
    similarity: 0.761,
});

export const BAQARAH_UNRELATED_PRODUCTION_REPLAY = replayEvidence({
    chunkId: 'c_0c5c342e9579326bbc457839c78ef9603ecd8c7de87c9c8b26e6a0757503a299_000_12f0dac8ffdc',
    canonicalUnitId: 'u_0c5c342e9579326bbc457839c78ef9603ecd8c7de87c9c8b26e6a0757503a299',
    retrievalText: 'Surat Al-Baqarah describes how the Children of Israel were commanded to slaughter a cow and asked about its age and color.',
    surah: 2,
    verseStart: 68,
    verseEnd: 71,
    similarity: 0.789,
});

export const FOOTBALL_PRODUCTION_REPLAY: readonly RetrievedEvidence[] = [
    replayEvidence({
        chunkId: 'production-observed-ibn-kathir-2-68-71-12f0dac8ffdc',
        canonicalUnitId: 'production-observed-unit-2-68-71',
        retrievalText: 'The Children of Israel were commanded to slaughter a cow and asked about its age and color.',
        surah: 2,
        verseStart: 68,
        verseEnd: 71,
        similarity: 0.781,
    }),
    replayEvidence({
        chunkId: 'production-observed-ibn-kathir-15-87-88-d44d0c8ad1af',
        canonicalUnitId: 'production-observed-unit-15-87-88',
        retrievalText: 'Allah gave the seven repeatedly recited verses and the Grand Quran, so do not extend your eyes toward worldly enjoyment.',
        surah: 15,
        verseStart: 87,
        verseEnd: 88,
        similarity: 0.774,
    }),
];
