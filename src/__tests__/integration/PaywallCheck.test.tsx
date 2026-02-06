import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PaywallScreen from '../../presentation/components/paywall/PaywallScreen';
import { ProProvider } from '../../infrastructure/auth/ProContext';
import { PaperProvider } from 'react-native-paper';

// Mock Navigation
jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: jest.fn(),
        push: jest.fn(),
    }),
}));

// Mock Moti due to Reanimated issues in Jest
jest.mock('moti', () => ({
    MotiView: 'View',
}));

// Mock RevenueCat
jest.mock('../../infrastructure/payments/RevenueCatService', () => ({
    revenueCatService: {
        getOfferings: jest.fn().mockResolvedValue({
            current: {
                availablePackages: [
                    {
                        identifier: 'pro_monthly',
                        product: {
                            title: 'Pro Monthly',
                            description: 'Unlock everything',
                            priceString: '$4.99',
                        },
                    },
                ],
            },
        }),
        purchasePackage: jest.fn().mockResolvedValue(true),
        restorePurchases: jest.fn().mockResolvedValue(true),
    },
    PurchasesOffering: {},
    PurchasesPackage: {},
}));

describe('PaywallScreen Integration', () => {
    it('renders correctly without crashing', async () => {
        const component = render(
            <PaperProvider>
                <ProProvider>
                    <PaywallScreen />
                </ProProvider>
            </PaperProvider>
        );

        expect(component).toBeTruthy();

        // Wait for loading to finish
        await waitFor(() => {
            expect(component.getByText('Unlock Premium')).toBeTruthy();
        });
    });

    it('displays mock packages', async () => {
        const { getByText } = render(
            <PaperProvider>
                <ProProvider>
                    <PaywallScreen />
                </ProProvider>
            </PaperProvider>
        );

        await waitFor(() => {
            expect(getByText('Pro Monthly')).toBeTruthy();
            expect(getByText('$4.99')).toBeTruthy();
        });
    });
});
