import { createNoorRemoteService } from './NoorRemoteService';
import { NoorRequest } from '../domain/generatedContract';
import { auth } from '../../../core/firebase/config';

jest.mock('../../../core/firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('../../../core/firebase/AppCheckService', () => ({
    getQuranNotesAppCheckToken: jest.fn(async () => 'app-check-token'),
}));

const request: NoorRequest = {
    mode: 'chat',
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    question: 'What does the Quran teach about patience?',
    history: [],
};

const citation = {
    chunkId: 'chunk-1',
    canonicalUnitId: 'unit-1',
    source: 'al_sadi_ar' as const,
    sourceTitle: "Tafsir Al-Sa'di",
    surah: 2,
    verseStart: 153,
    verseEnd: 153,
    corpusVersion: 'corpus-v1',
};

const answer = {
    requestId: request.requestId,
    answer: 'A grounded answer.',
    status: 'answered' as const,
    citations: [citation],
};

describe('NoorRemoteService', () => {
    afterEach(() => {
        (auth as unknown as { currentUser: { uid: string } | null }).currentUser = null;
    });

    it('uses the exact authenticated callable wire envelope', async () => {
        const fetchImpl = jest.fn(async () => ({
            ok: true,
            json: async () => ({ result: answer }),
        })) as unknown as typeof fetch;
        const service = createNoorRemoteService({
            getAuthToken: async () => 'auth-token',
            getAppCheckToken: async () => 'app-check-token',
            fetchImpl,
        });

        await expect(service.ask(request)).resolves.toEqual(answer);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer auth-token',
                    'X-Firebase-AppCheck': 'app-check-token',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: request }),
            }),
        );
    });

    it.each([
        ['missing auth', async () => '', async () => 'app-check-token'],
        ['missing app check', async () => 'auth-token', async () => ''],
    ])('does not fetch with %s', async (_name, getAuthToken, getAppCheckToken) => {
        const fetchImpl = jest.fn();
        const service = createNoorRemoteService({ getAuthToken, getAppCheckToken, fetchImpl });
        await expect(service.ask(request)).rejects.toMatchObject({ code: expect.any(String) });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
        { data: answer },
        { result: answer, extra: true },
        { result: { ...answer, status: 'made_up' } },
        { result: { ...answer, requestId: '550e8400-e29b-41d4-a716-446655440001' } },
        { result: { ...answer, citations: [] } },
        { result: { ...answer, status: 'insufficient_evidence' } },
        { result: { ...answer, answer: '' } },
        { result: { ...answer, answer: 'a'.repeat(10_001) } },
        { result: { ...answer, citations: [{ chunkId: '', canonicalUnitId: 'u1', source: 'al_sadi_ar', sourceTitle: 'Al-Sadi', surah: 1, verseStart: 1, verseEnd: 1, corpusVersion: 'v1' }] } },
        { result: { ...answer, citations: [{ chunkId: 'c1', canonicalUnitId: 'u1', source: 'al_sadi_ar', sourceTitle: 'Al-Sadi', surah: 1, verseStart: 1, verseEnd: 1, corpusVersion: 'v1', extra: true }] } },
        { result: { ...answer, citations: [{ chunkId: 'c1', canonicalUnitId: 'u1', source: 'al_sadi_ar', sourceTitle: 'Al-Sadi', surah: 1, verseStart: 8, verseEnd: 8, corpusVersion: 'v1' }] } },
        { result: { ...answer, status: 'quota_exceeded', nextResetAt: '2026-02-30T00:00:00Z' } },
        { error: { message: 'secret provider detail' } },
    ])('rejects malformed or error envelopes without leaking details', async (envelope) => {
        const service = createNoorRemoteService({
            getAuthToken: async () => 'auth-token',
            getAppCheckToken: async () => 'app-check-token',
            fetchImpl: jest.fn(async () => ({ ok: true, json: async () => envelope })) as unknown as typeof fetch,
        });
        await expect(service.ask(request)).rejects.toMatchObject({ code: 'invalid_response' });
    });

    it('aborts after the bounded timeout with a safe error', async () => {
        jest.useFakeTimers();
        const service = createNoorRemoteService({
            getAuthToken: async () => 'auth-token',
            getAppCheckToken: async () => 'app-check-token',
            timeoutMs: 25_000,
            fetchImpl: jest.fn((_url, init) => new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new Error('raw abort detail')));
            })) as unknown as typeof fetch,
        });
        const pending = expect(service.ask(request)).rejects.toMatchObject({ code: 'temporarily_unavailable' });
        await jest.advanceTimersByTimeAsync(25_000);
        await pending;
        jest.useRealTimers();
    });

    it('never sends a persisted request with a different Firebase user token', async () => {
        const mutableAuth = auth as unknown as { currentUser: { uid: string } | null };
        mutableAuth.currentUser = { uid: 'owner-a' };
        const fetchImpl = jest.fn();
        const service = createNoorRemoteService({
            getAuthToken: async () => {
                mutableAuth.currentUser = { uid: 'owner-b' };
                return 'owner-b-token';
            },
            getAppCheckToken: async () => 'app-check-token',
            fetchImpl,
        });

        await expect(service.ask(request, 'owner-a')).rejects.toMatchObject({ code: 'signed_out' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
