import { createNoorAIService } from './NoorAIService';
import { NoorAnswer } from './generatedContract';

jest.mock('../../../core/firebase/config', () => ({ auth: { currentUser: null } }));
jest.mock('../../../core/firebase/AppCheckService', () => ({
    getQuranNotesAppCheckToken: jest.fn(async () => 'app-check-token'),
}));

describe('NoorAIService', () => {
    it('sends bounded history and preserves the typed answer', async () => {
        const answer: NoorAnswer = {
            requestId: '550e8400-e29b-41d4-a716-446655440000',
            answer: 'Grounded answer',
            status: 'quota_exceeded',
            citations: [],
            nextResetAt: '2026-08-12T00:00:00.000Z',
        };
        const remote = { ask: jest.fn(async () => answer) };
        const service = createNoorAIService(remote, () => answer.requestId);
        const history = Array.from({ length: 8 }, (_, index) => ({
            id: String(index),
            role: index % 2 ? 'noor' as const : 'user' as const,
            content: `message ${index}`,
            timestamp: index,
        }));

        await expect(service.askNoor('Question', history)).resolves.toEqual(answer);
        expect(remote.ask).toHaveBeenCalledWith({
            mode: 'chat',
            requestId: answer.requestId,
            question: 'Question',
            history: [
                { role: 'user', content: 'message 2' },
                { role: 'assistant', content: 'message 3' },
                { role: 'user', content: 'message 4' },
                { role: 'assistant', content: 'message 5' },
                { role: 'user', content: 'message 6' },
                { role: 'assistant', content: 'message 7' },
            ],
        });
    });
});
