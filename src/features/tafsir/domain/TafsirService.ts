import { NoorRemoteClient, noorRemoteService } from '../../noor-ai/infrastructure/NoorRemoteService';
import { NoorRequest, NoorSource } from '../../noor-ai/domain/generatedContract';
import { AiQueryResult, TafsirSource } from './types';

function createRequestId(): string {
    const random = (): string => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
    return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

function toRemoteSource(source: TafsirSource): NoorSource {
    return source === 'ibn_kathir' ? 'ibn_kathir_en_abridged' : 'al_sadi_ar';
}

export function createTafsirService(remote: NoorRemoteClient, requestIdFactory = createRequestId) {
    const ask = async (request: NoorRequest): Promise<AiQueryResult> => {
        const result = await remote.ask(request);
        return { ...result, cached: false };
    };
    return {
        async summarizeTafsir(
            _arabicText: string,
            _translation: string,
            _tafsirText: string,
            source: TafsirSource,
            _surahName: string,
            surahNumber: number,
            verseNumber: number,
        ): Promise<AiQueryResult> {
            return ask({
                mode: 'verse_summary',
                requestId: requestIdFactory(),
                source: toRemoteSource(source),
                surah: surahNumber,
                verse: verseNumber,
            });
        },
        async askAboutVerse(
            question: string,
            _arabicText: string,
            _translation: string,
            _tafsirText: string,
            source: TafsirSource,
            _surahName: string,
            surahNumber: number,
            verseNumber: number,
        ): Promise<AiQueryResult> {
            return ask({
                mode: 'verse_question',
                requestId: requestIdFactory(),
                source: toRemoteSource(source),
                surah: surahNumber,
                verse: verseNumber,
                question,
            });
        },
    };
}

const service = createTafsirService(noorRemoteService);

export const summarizeTafsir = service.summarizeTafsir;
export const askAboutVerse = service.askAboutVerse;

export function isAiAvailable(): boolean {
    return true;
}
