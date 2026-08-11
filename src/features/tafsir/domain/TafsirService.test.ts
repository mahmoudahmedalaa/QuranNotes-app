import { createTafsirService } from './TafsirService';

jest.mock('../../../core/firebase/config', () => ({ auth: { currentUser: null } }));

describe('TafsirService', () => {
    it.each([
        ['ibn_kathir' as const, 'ibn_kathir_en_abridged'],
        ['al_sadi' as const, 'al_sadi_ar'],
    ])('maps %s summaries to the canonical source %s', async (source, expectedSource) => {
        const ask = jest.fn(async (request) => ({
            requestId: request.requestId,
            answer: 'Summary',
            status: 'answered' as const,
            citations: [],
        }));
        const service = createTafsirService({ ask }, () => '550e8400-e29b-41d4-a716-446655440000');
        await service.summarizeTafsir('arabic', 'translation', 'local commentary', source, 'Name', 2, 255);
        expect(ask).toHaveBeenCalledWith({
            mode: 'verse_summary',
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            source: expectedSource,
            surah: 2,
            verse: 255,
        });
    });

    it('sends verse questions without local commentary or local quota state', async () => {
        const ask = jest.fn(async (request) => ({
            requestId: request.requestId,
            answer: 'Answer',
            status: 'answered' as const,
            citations: [],
        }));
        const service = createTafsirService({ ask }, () => '550e8400-e29b-41d4-a716-446655440000');
        await service.askAboutVerse('Why?', 'arabic', 'translation', 'local commentary', 'al_sadi', 'Name', 1, 7);
        expect(ask).toHaveBeenCalledWith({
            mode: 'verse_question',
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            source: 'al_sadi_ar',
            surah: 1,
            verse: 7,
            question: 'Why?',
        });
    });
});
