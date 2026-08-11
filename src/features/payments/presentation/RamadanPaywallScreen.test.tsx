import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PurchasesOffering, PurchasesPackage } from '../infrastructure/RevenueCatService';
import RamadanPaywallScreen from './RamadanPaywallScreen';
import { revenueCatService } from '../infrastructure/RevenueCatService';

const mockCheckStatus = jest.fn();
const mockOnPurchaseSuccess = jest.fn();

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
    useAuth: () => ({ user: { id: 'firebase-user' } }),
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

describe('RamadanPaywallScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        serviceMock().getOfferings.mockResolvedValue(offering);
        serviceMock().ensureUserIdentity.mockResolvedValue({ entitlements: { active: {} } });
        serviceMock().purchasePackage.mockResolvedValue({ success: true });
        serviceMock().restorePurchases.mockResolvedValue(true);
        mockCheckStatus.mockResolvedValue(true);
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

    it('purchases Lifetime only after Firebase UID binding and verified entitlement refresh', async () => {
        const screen = render(<RamadanPaywallScreen onPurchaseSuccess={mockOnPurchaseSuccess} />);
        await waitFor(() => expect(screen.getByLabelText('Select Lifetime plan')).toBeTruthy());
        fireEvent.press(screen.getByLabelText('Select Lifetime plan'));
        fireEvent.press(screen.getByLabelText('Purchase selected plan'));

        await waitFor(() => expect(serviceMock().purchasePackage).toHaveBeenCalled());
        expect(serviceMock().ensureUserIdentity).toHaveBeenCalledWith('firebase-user');
        expect(serviceMock().purchasePackage.mock.calls[0][0].identifier).toBe('$rc_lifetime');
        expect(mockCheckStatus).toHaveBeenCalled();
        expect(mockOnPurchaseSuccess).toHaveBeenCalled();
    });

    it('does not render or substitute a missing Lifetime package', async () => {
        serviceMock().getOfferings.mockResolvedValue({ ...offering, lifetime: null });
        const screen = render(<RamadanPaywallScreen />);

        await waitFor(() => expect(screen.getByLabelText('Select Annual plan')).toBeTruthy());
        expect(screen.queryByLabelText('Select Lifetime plan')).toBeNull();
    });
});
