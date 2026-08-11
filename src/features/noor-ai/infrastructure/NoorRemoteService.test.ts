import { createNoorRemoteService } from './NoorRemoteService';
import { NoorRequest } from '../domain/generatedContract';

jest.mock('../../../core/firebase/config', () => ({ auth: { currentUser: null } }));

const request: NoorRequest = {
    mode: 'chat',
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    question: 'What does the Quran teach about patience?',
    history: [],
};

const answer = {
    requestId: request.requestId,
    answer: 'A grounded answer.',
    status: 'answered' as const,
    citations: [],
};

describe('NoorRemoteService', () => {
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
});
