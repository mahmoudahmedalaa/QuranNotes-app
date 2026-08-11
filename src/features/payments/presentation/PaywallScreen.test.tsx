import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PurchasesOffering, PurchasesPackage } from '../infrastructure/RevenueCatService';
import PaywallScreen from './PaywallScreen';
import { revenueCatService } from '../infrastructure/RevenueCatService';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCheckStatus = jest.fn();
let mockHardPaywall = '1';
let mockUser: { id: string } | null = { id: 'firebase-user' };

jest.mock('expo-router', () => ({
    useRouter: () => ({ replace: mockReplace, back: mockBack }),
    useLocalSearchParams: () => ({ hard: mockHardPaywall }),
    Redirect: () => null,
}));

jest.mock('moti', () => ({
    MotiView: 'View',
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    ImpactFeedbackStyle: { Medium: 'medium' },
    NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('../../auth/infrastructure/ProContext', () => ({
    usePro: () => ({ checkStatus: mockCheckStatus, identityReady: true }),
}));

jest.mock('../../auth/infrastructure/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}));

jest.mock('../infrastructure/TelemetryService', () => ({
    TelemetryService: {
        trackPaywallView: jest.fn().mockResolvedValue(undefined),
        trackSubscriptionEvent: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../../core/utils/ramadanUtils', () => ({ isRamadanSeason: () => false }));

jest.mock('../infrastructure/RevenueCatService', () => ({
    revenueCatService: {
        getOfferings: jest.fn(),
        ensureUserIdentity: jest.fn(),
        purchasePackage: jest.fn(),
        restorePurchases: jest.fn(),
    },
}));

function makePackage(identifier: string, priceString: string): PurchasesPackage {
    return {
        identifier,
        product: { priceString, introPrice: null },
    } as unknown as PurchasesPackage;
}

function makeOffering(periods: ('monthly' | 'annual' | 'lifetime')[]): PurchasesOffering {
    const packages = {
        monthly: makePackage('$rc_monthly', '€4,99'),
        annual: makePackage('$rc_annual', '€35,99'),
        lifetime: makePackage('$rc_lifetime', '€79,99'),
    };
    return {
        monthly: periods.includes('monthly') ? packages.monthly : null,
        annual: periods.includes('annual') ? packages.annual : null,
        lifetime: periods.includes('lifetime') ? packages.lifetime : null,
    } as unknown as PurchasesOffering;
}

function serviceMock() {
    return revenueCatService as unknown as {
        getOfferings: jest.Mock;
        ensureUserIdentity: jest.Mock;
        purchasePackage: jest.Mock;
        restorePurchases: jest.Mock;
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(next => {
        resolve = next;
    });
    return { promise, resolve };
}

describe('PaywallScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHardPaywall = '1';
        mockUser = { id: 'firebase-user' };
        serviceMock().getOfferings.mockResolvedValue(makeOffering(['monthly', 'annual', 'lifetime']));
        serviceMock().ensureUserIdentity.mockResolvedValue({ entitlements: { active: {} } });
        serviceMock().purchasePackage.mockResolvedValue({ success: true });
        serviceMock().restorePurchases.mockResolvedValue(true);
        mockCheckStatus.mockResolvedValue(true);
        jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
    });

    it('renders only present plans with localized prices and the exact Lifetime and fair-use copy', async () => {
        const screen = render(<PaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.getByLabelText('Select Monthly plan')).toBeTruthy();
        expect(screen.getByLabelText('Select Lifetime plan')).toBeTruthy();
        expect(screen.getByText('€4,99')).toBeTruthy();
        expect(screen.getByText('€35,99')).toBeTruthy();
        expect(screen.getByText('€79,99')).toBeTruthy();
        expect(screen.getByText('One-time purchase')).toBeTruthy();
        expect(screen.getByText('Includes up to 50 successful AI answers per UTC day. Your allowance resets daily.')).toBeTruthy();
        expect(screen.queryByText(/Unlimited AI|unlimited AI-powered/i)).toBeNull();
    });

    it('uses Lifetime-compatible Pro access copy on the hard paywall', async () => {
        const screen = render(<PaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.queryByText(/active subscription/i)).toBeNull();
        expect(screen.getByText(/active Pro access or purchase/i)).toBeTruthy();
    });

    it('defaults to Monthly when Annual is absent and does not invent missing plans', async () => {
        serviceMock().getOfferings.mockResolvedValue(makeOffering(['monthly']));
        const screen = render(<PaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Monthly plan')).toBeTruthy());
        expect(screen.queryByLabelText('Select Annual plan')).toBeNull();
        expect(screen.queryByLabelText('Select Lifetime plan')).toBeNull();
        expect(screen.getByText('Monthly subscription')).toBeTruthy();
    });

    it.each([
        ['monthly', '$rc_monthly'],
        ['annual', '$rc_annual'],
        ['lifetime', '$rc_lifetime'],
    ] as const)('binds identity and purchases the selected %s package', async (period, identifier) => {
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText(`Select ${period[0].toUpperCase()}${period.slice(1)} plan`)).toBeTruthy());
        fireEvent.press(screen.getByLabelText(`Select ${period[0].toUpperCase()}${period.slice(1)} plan`));
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(serviceMock().purchasePackage.mock.calls[0][0].identifier).toBe(identifier);
        expect(mockCheckStatus).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('does not navigate when the authoritative entitlement refresh stays locked', async () => {
        mockCheckStatus.mockResolvedValue(false);
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Purchase selected plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(mockCheckStatus).toHaveBeenCalled());
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('requires authentication before purchase or restore', async () => {
        mockUser = null;
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Purchase selected plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));
        fireEvent.press(screen.getByText('Restore Purchases'));

        expect(serviceMock().ensureUserIdentity).not.toHaveBeenCalled();
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(serviceMock().restorePurchases).not.toHaveBeenCalled();
    });

    it('fails closed when RevenueCat cannot bind the authenticated Firebase UID', async () => {
        serviceMock().ensureUserIdentity.mockRejectedValue(new Error('sanitized identity failure'));
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Purchase selected plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user'));
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(mockReplace).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.');
    });

    it('binds identity before restore and navigates only after active pro_access refresh', async () => {
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByText('Restore Purchases')).toBeTruthy());
        fireEvent.press(screen.getByText('Restore Purchases'));

        await waitFor(() => expect(serviceMock().restorePurchases).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(mockCheckStatus).toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('keeps purchase cancellation silent', async () => {
        serviceMock().purchasePackage.mockResolvedValue({ success: false, userCancelled: true });
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Purchase selected plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('synchronously blocks duplicate restore and purchase overlap while all purchase controls are disabled', async () => {
        const identity = deferred<unknown>();
        serviceMock().ensureUserIdentity.mockReturnValue(identity.promise);
        const screen = render(<PaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());

        fireEvent.press(screen.getByLabelText('Restore purchases'));
        fireEvent.press(screen.getByLabelText('Restore purchases'));
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledTimes(1);
        expect(serviceMock().restorePurchases).not.toHaveBeenCalled();
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Restore purchases').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Purchase selected plan').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Select Lifetime plan').props.accessibilityState.disabled).toBe(true);

        identity.resolve({ entitlements: { active: {} } });
        await waitFor(() => expect(serviceMock().restorePurchases).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByLabelText('Restore purchases').props.accessibilityState.disabled).toBe(false));
    });
});
