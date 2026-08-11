import type { PurchasesOffering, PurchasesPackage } from '../infrastructure/RevenueCatService';
import {
    getAvailableBillingPeriods,
    getBillingPeriodUnit,
    getDefaultBillingPeriod,
    getSelectedPackage,
    getTrialBadgeText,
} from './paywallOfferUtils';

function makePackage(identifier: string, priceString: string, withTrial = false): PurchasesPackage {
    return {
        identifier,
        product: {
            priceString,
            introPrice: withTrial
                ? {
                    price: 0,
                    priceString: '$0.00',
                    periodNumberOfUnits: 7,
                    periodUnit: 'DAY',
                }
                : null,
        },
    } as unknown as PurchasesPackage;
}

function makeOffering(packages: Partial<Record<'monthly' | 'annual' | 'lifetime', PurchasesPackage>>): PurchasesOffering {
    return {
        monthly: packages.monthly ?? null,
        annual: packages.annual ?? null,
        lifetime: packages.lifetime ?? null,
    } as unknown as PurchasesOffering;
}

describe('paywallOfferUtils', () => {
    const monthly = makePackage('$rc_monthly', 'US$4.99');
    const annual = makePackage('$rc_annual', 'US$35.99');
    const lifetime = makePackage('$rc_lifetime', 'US$79.99', true);
    const offering = makeOffering({ monthly, annual, lifetime });

    it.each([
        ['monthly', monthly],
        ['annual', annual],
        ['lifetime', lifetime],
    ] as const)('returns the exact %s package', (period, expectedPackage) => {
        expect(getSelectedPackage(offering, period)).toBe(expectedPackage);
    });

    it('returns null instead of substituting another package when the selection is missing', () => {
        expect(getSelectedPackage(makeOffering({ annual }), 'monthly')).toBeNull();
        expect(getSelectedPackage(makeOffering({ annual }), 'lifetime')).toBeNull();
        expect(getSelectedPackage(null, 'annual')).toBeNull();
    });

    it('lists only packages that are present in the current offering', () => {
        expect(getAvailableBillingPeriods(makeOffering({ monthly, lifetime }))).toEqual(['monthly', 'lifetime']);
    });

    it('defaults to Annual, then Monthly, then Lifetime', () => {
        expect(getDefaultBillingPeriod(offering)).toBe('annual');
        expect(getDefaultBillingPeriod(makeOffering({ monthly, lifetime }))).toBe('monthly');
        expect(getDefaultBillingPeriod(makeOffering({ lifetime }))).toBe('lifetime');
        expect(getDefaultBillingPeriod(makeOffering({}))).toBeNull();
    });

    it('never gives Lifetime trial or recurring-unit language', () => {
        expect(getTrialBadgeText(lifetime, 'lifetime')).toBeNull();
        expect(getBillingPeriodUnit('lifetime')).toBeNull();
        expect(getBillingPeriodUnit('monthly')).toBe('/month');
        expect(getBillingPeriodUnit('annual')).toBe('/year');
    });
});
