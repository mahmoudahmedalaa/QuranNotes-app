import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PurchasesOffering, PurchasesPackage } from '../infrastructure/RevenueCatService';
import RamadanPaywallScreen from './RamadanPaywallScreen';
import { revenueCatService } from '../infrastructure/RevenueCatService';

const mockCheckStatus = jest.fn();
const mockOnPurchaseSuccess = jest.fn();
const mockBack = jest.fn();
let mockUser: { id: string } | null = { id: 'firebase-user' };

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: mockBack }),
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
    usePro: () => ({ checkStatus: mockCheckStatus }),
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
jest.mock('../../../core/utils/ramadanUtils', () => ({ ramadanCountdownText: () => '10 days left' }));
jest.mock('../infrastructure/RevenueCatService', () => ({
    revenueCatService: {
        getOfferings: jest.fn(),
        ensureUserIdentity: jest.fn(),
        purchasePackage: jest.fn(),
        restorePurchases: jest.fn(),
    },
}));

function makePackage(identifier: string, priceString: string): PurchasesPackage {
    return { identifier, product: { priceString, introPrice: null } } as unknown as PurchasesPackage;
}

const offering = {
    monthly: makePackage('$rc_monthly', 'AED 19.99'),
    annual: makePackage('$rc_annual', 'AED 139.99'),
    lifetime: makePackage('$rc_lifetime', 'AED 299.99'),
} as unknown as PurchasesOffering;

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

describe('RamadanPaywallScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 'firebase-user' };
        serviceMock().getOfferings.mockResolvedValue(offering);
        serviceMock().ensureUserIdentity.mockResolvedValue({ entitlements: { active: {} } });
        serviceMock().purchasePackage.mockResolvedValue({ success: true });
        serviceMock().restorePurchases.mockResolvedValue(true);
        mockCheckStatus.mockResolvedValue(true);
        jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
        jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    });

    it('renders all three current-offering plans with localized prices and fair-use copy', async () => {
        const screen = render(<RamadanPaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.getByLabelText('Select Monthly plan')).toBeTruthy();
        expect(screen.getByLabelText('Select Lifetime plan')).toBeTruthy();
        expect(screen.getByText('AED 19.99')).toBeTruthy();
        expect(screen.getByText('AED 139.99')).toBeTruthy();
        expect(screen.getByText('AED 299.99')).toBeTruthy();
        expect(screen.getByText('One-time purchase')).toBeTruthy();
        expect(screen.getByText('Includes up to 50 successful AI answers per UTC day. Your allowance resets daily.')).toBeTruthy();
    });

    it('hides every dismissal control when dismissal is not allowed', async () => {
        const screen = render(<RamadanPaywallScreen allowDismiss={false} />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.queryByLabelText('Dismiss paywall')).toBeNull();
        expect(screen.queryByText('Maybe Later')).toBeNull();
    });

    it('keeps dismissal controls active on a soft paywall', async () => {
        const onDismiss = jest.fn();
        const screen = render(<RamadanPaywallScreen allowDismiss onDismiss={onDismiss} />);

        await waitFor(() => expect(screen.getByLabelText('Dismiss paywall')).toBeTruthy());
        expect(screen.getByText('Maybe Later')).toBeTruthy();
        fireEvent.press(screen.getByText('Maybe Later'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('never navigates back from a hard paywall while authoritative status remains locked', async () => {
        mockCheckStatus.mockResolvedValue(false);
        const screen = render(<RamadanPaywallScreen allowDismiss={false} />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());

        fireEvent.press(screen.getByLabelText('Purchase selected plan'));
        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Purchase Pending', expect.any(String)));
        fireEvent.press(screen.getByLabelText('Restore purchases'));
        await waitFor(() => expect(serviceMock().restorePurchases).toHaveBeenCalled());

        expect(mockBack).not.toHaveBeenCalled();
    });

    it.each([
        ['Monthly', '$rc_monthly'],
        ['Annual', '$rc_annual'],
        ['Lifetime', '$rc_lifetime'],
    ] as const)('purchases %s only after binding the current Firebase UID and refreshing entitlement', async (label, identifier) => {
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText(`Select ${label} plan`)).toBeTruthy());
        fireEvent.press(screen.getByLabelText(`Select ${label} plan`));
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(serviceMock().purchasePackage.mock.calls[0][0].identifier).toBe(identifier);
        expect(mockCheckStatus).toHaveBeenCalled();
        expect(mockOnPurchaseSuccess).toHaveBeenCalled();
    });

    it('restores only for the current Firebase UID and unlocks after authoritative refresh', async () => {
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByText('Restore Purchases')).toBeTruthy());
        fireEvent.press(screen.getByText('Restore Purchases'));

        await waitFor(() => expect(serviceMock().restorePurchases).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(mockCheckStatus).toHaveBeenCalled();
        expect(mockOnPurchaseSuccess).toHaveBeenCalled();
    });

    it('uses the newly switched Firebase UID for the next purchase', async () => {
        mockUser = { id: 'prior-user' };
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());

        mockUser = { id: 'current-user' };
        screen.rerender(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        serviceMock().ensureUserIdentity.mockClear();
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('current-user');
        expect(serviceMock().ensureUserIdentity).not.toHaveBeenCalledWith('prior-user');
    });

    it('keeps signed-out purchase and restore attempts locked', async () => {
        mockUser = null;
        const screen = render(<RamadanPaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));
        fireEvent.press(screen.getByText('Restore Purchases'));

        expect(serviceMock().ensureUserIdentity).not.toHaveBeenCalled();
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(serviceMock().restorePurchases).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Sign In Required', expect.any(String));
    });

    it('fails closed when Firebase UID binding fails', async () => {
        serviceMock().ensureUserIdentity.mockRejectedValue(new Error('sanitized identity failure'));
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong. Please try again.'));
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(mockOnPurchaseSuccess).not.toHaveBeenCalled();
    });

    it('keeps cancellation silent', async () => {
        serviceMock().purchasePackage.mockResolvedValue({ success: false, userCancelled: true });
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(Alert.alert).not.toHaveBeenCalled();
        expect(mockOnPurchaseSuccess).not.toHaveBeenCalled();
    });

    it('stays locked when the authoritative entitlement refresh returns false', async () => {
        mockCheckStatus.mockResolvedValue(false);
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(mockCheckStatus).toHaveBeenCalled());
        expect(mockOnPurchaseSuccess).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenCalledWith('Purchase Pending', expect.any(String));
    });

    it('synchronously blocks purchase and duplicate restore overlap while controls are disabled', async () => {
        const identity = deferred<unknown>();
        serviceMock().ensureUserIdentity.mockReturnValue(identity.promise);
        const screen = render(<RamadanPaywallScreen />);
        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());

        fireEvent.press(screen.getByLabelText('Purchase selected plan'));
        fireEvent.press(screen.getByLabelText('Restore purchases'));
        fireEvent.press(screen.getByLabelText('Restore purchases'));

        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledTimes(1);
        expect(serviceMock().purchasePackage).not.toHaveBeenCalled();
        expect(serviceMock().restorePurchases).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Purchase selected plan').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Restore purchases').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByLabelText('Select Monthly plan').props.accessibilityState.disabled).toBe(true);

        identity.resolve({ entitlements: { active: {} } });
        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByLabelText('Restore purchases').props.accessibilityState.disabled).toBe(false));
    });

    it('does not render or substitute a missing Lifetime package', async () => {
        serviceMock().getOfferings.mockResolvedValue({ ...offering, lifetime: null });
        const screen = render(<RamadanPaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.queryByLabelText('Select Lifetime plan')).toBeNull();
    });
});
