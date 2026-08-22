import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    clearPendingNoorRequest,
    isPendingNoorRequestRecoverable,
    loadPendingNoorRequest,
    savePendingNoorRequest,
} from './NoorConversationHistory';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

const pendingRequest = {
    version: 1 as const,
    status: 'pending' as const,
    ownerUid: 'user-1',
    conversationId: 'conversation-1',
    userMessageId: 'message-1',
    createdAt: 1_777_000_000_000,
    request: {
        mode: 'chat' as const,
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        question: 'What does the Quran say about riba?',
        history: [],
    },
};

describe('Noor pending request persistence', () => {
    beforeEach(() => jest.clearAllMocks());

    it('persists and restores the minimum replayable request state', async () => {
        await savePendingNoorRequest(pendingRequest);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
            '@qurannotes/user/user-1/@noor_pending_request_v1',
            JSON.stringify(pendingRequest),
        );

        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(pendingRequest));
        await expect(loadPendingNoorRequest('user-1')).resolves.toEqual(pendingRequest);
    });

    it('clears only the matching finalized request', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(pendingRequest));

        await clearPendingNoorRequest('550e8400-e29b-41d4-a716-446655440001', 'user-1');
        expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

        await clearPendingNoorRequest(pendingRequest.request.requestId, 'user-1');
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
            '@qurannotes/user/user-1/@noor_pending_request_v1',
        );
    });

    it('rejects malformed local pending state without replaying it', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
            ...pendingRequest,
            request: { ...pendingRequest.request, requestId: 'not-a-request-id' },
        }));

        await expect(loadPendingNoorRequest('user-1')).resolves.toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
            '@qurannotes/user/user-1/@noor_pending_request_v1',
        );
    });

    it('does not restore another Firebase user pending request', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(pendingRequest));

        await expect(loadPendingNoorRequest('user-2')).resolves.toBeNull();
    });

    it('allows automatic recovery only inside the backend replay window', () => {
        const now = pendingRequest.createdAt + 60_000;
        expect(isPendingNoorRequestRecoverable(pendingRequest, now)).toBe(true);
        expect(isPendingNoorRequestRecoverable(pendingRequest, pendingRequest.createdAt + 9 * 60_000)).toBe(false);
    });
});
