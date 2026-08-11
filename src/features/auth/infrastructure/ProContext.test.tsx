import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { User } from '../domain/User';
import { ProProvider, usePro } from './ProContext';
import { revenueCatService } from '../../payments/infrastructure/RevenueCatService';

let mockCurrentUser: User | null = null;

jest.mock('./AuthContext', () => ({
    useAuth: () => ({ user: mockCurrentUser }),
}));

jest.mock('../../payments/infrastructure/RevenueCatService', () => ({
    revenueCatService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        ensureUserIdentity: jest.fn(),
        logoutUser: jest.fn().mockResolvedValue(undefined),
        getCustomerInfo: jest.fn(),
        isPro: jest.fn(),
        restorePurchases: jest.fn(),
    },
}));

const PRO_INFO = { entitlements: { active: { pro_access: { identifier: 'pro_access' } } } };
const LOCKED_INFO = { entitlements: { active: {} } };

function user(id: string, email = `${id}@example.com`): User {
    return {
        id,
        email,
        displayName: null,
        isAnonymous: false,
        photoURL: null,
        createdAt: null,
        lastSignInAt: null,
    };
}

function mockService() {
    return revenueCatService as unknown as {
        ensureUserIdentity: jest.Mock;
        logoutUser: jest.Mock;
        getCustomerInfo: jest.Mock;
        isPro: jest.Mock;
        restorePurchases: jest.Mock;
    };
}

function wrapper({ children }: { children: React.ReactNode }) {
    return <ProProvider>{children}</ProProvider>;
}

describe('ProContext RevenueCat identity isolation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentUser = null;
        mockService().ensureUserIdentity.mockResolvedValue(LOCKED_INFO);
        mockService().getCustomerInfo.mockResolvedValue(LOCKED_INFO);
        mockService().isPro.mockImplementation((info: typeof LOCKED_INFO | typeof PRO_INFO) => (
            'pro_access' in info.entitlements.active
        ));
        mockService().logoutUser.mockResolvedValue(undefined);
        mockService().restorePurchases.mockResolvedValue(false);
    });

    it('binds the initial Firebase UID before exposing its entitlement', async () => {
        mockCurrentUser = user('user-one');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result } = renderHook(() => usePro(), { wrapper });

        expect(result.current.isPro).toBe(false);
        expect(result.current.identityReady).toBe(false);

        await waitFor(() => expect(result.current.identityReady).toBe(true));
        expect(mockService().ensureUserIdentity).toHaveBeenCalledWith('user-one');
        expect(mockService().getCustomerInfo).toHaveBeenCalled();
        expect(result.current.isPro).toBe(true);
    });

    it('clears Pro immediately during an account switch and ignores the prior entitlement', async () => {
        mockCurrentUser = user('user-one');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result, rerender } = renderHook(() => usePro(), { wrapper });
        await waitFor(() => expect(result.current.isPro).toBe(true));

        let resolveSecondIdentity: ((value: typeof LOCKED_INFO) => void) | null = null;
        mockService().ensureUserIdentity.mockImplementationOnce(() => new Promise(resolve => {
            resolveSecondIdentity = resolve;
        }));
        mockService().getCustomerInfo.mockResolvedValue(LOCKED_INFO);
        mockCurrentUser = user('user-two');
        rerender({});

        await waitFor(() => expect(result.current.identityReady).toBe(false));
        expect(result.current.isPro).toBe(false);
        expect(mockService().ensureUserIdentity).toHaveBeenLastCalledWith('user-two');

        await act(async () => resolveSecondIdentity?.(LOCKED_INFO));
        await waitFor(() => expect(result.current.identityReady).toBe(true));
        expect(result.current.isPro).toBe(false);
    });

    it('clears identity readiness and Pro on logout', async () => {
        mockCurrentUser = user('user-one');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result, rerender } = renderHook(() => usePro(), { wrapper });
        await waitFor(() => expect(result.current.isPro).toBe(true));

        mockCurrentUser = null;
        rerender({});

        await waitFor(() => expect(mockService().logoutUser).toHaveBeenCalled());
        expect(result.current.identityReady).toBe(false);
        expect(result.current.isPro).toBe(false);
    });

    it('fails closed when the initial RevenueCat login fails', async () => {
        mockCurrentUser = user('locked-user');
        mockService().ensureUserIdentity.mockRejectedValue(new Error('sanitized login failure'));
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result } = renderHook(() => usePro(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.identityReady).toBe(false);
        expect(result.current.isPro).toBe(false);
        expect(mockService().getCustomerInfo).not.toHaveBeenCalled();
    });

    it('fails closed on a new-user identity mismatch without leaking the prior user entitlement', async () => {
        mockCurrentUser = user('prior-user');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result, rerender } = renderHook(() => usePro(), { wrapper });
        await waitFor(() => expect(result.current.isPro).toBe(true));

        mockService().ensureUserIdentity.mockClear();
        mockService().getCustomerInfo.mockClear();
        mockService().ensureUserIdentity.mockRejectedValue(new Error('sanitized identity mismatch'));
        mockCurrentUser = user('new-user');
        rerender({});

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(mockService().ensureUserIdentity).toHaveBeenCalledWith('new-user');
        expect(mockService().getCustomerInfo).not.toHaveBeenCalled();
        expect(result.current.identityReady).toBe(false);
        expect(result.current.isPro).toBe(false);
    });

    it('does not carry an anonymous entitlement through successful Firebase UID binding', async () => {
        mockCurrentUser = user('firebase-user');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(LOCKED_INFO);
        const { result } = renderHook(() => usePro(), { wrapper });

        await waitFor(() => expect(result.current.identityReady).toBe(true));
        expect(mockService().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(mockService().getCustomerInfo).toHaveBeenCalled();
        expect(result.current.isPro).toBe(false);
    });

    it('keeps the App Review and owner-QA account locked without active pro_access', async () => {
        mockCurrentUser = user('owner-qa', 'mahmoudahmedalaa+review@gmail.com');
        const { result } = renderHook(() => usePro(), { wrapper });

        await waitFor(() => expect(result.current.identityReady).toBe(true));
        expect(result.current.isPro).toBe(false);
    });

    it('returns the authoritative entitlement result from checkStatus', async () => {
        mockCurrentUser = user('user-one');
        mockService().ensureUserIdentity.mockResolvedValue(PRO_INFO);
        mockService().getCustomerInfo.mockResolvedValue(PRO_INFO);
        const { result } = renderHook(() => usePro(), { wrapper });
        await waitFor(() => expect(result.current.identityReady).toBe(true));

        let status = false;
        await act(async () => {
            status = await result.current.checkStatus();
        });
        expect(status).toBe(true);
    });
});
