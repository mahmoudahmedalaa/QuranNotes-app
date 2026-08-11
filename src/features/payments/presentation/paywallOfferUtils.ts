import { PurchasesPackage } from '../infrastructure/RevenueCatService';

export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';

const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'annual', 'lifetime'];

function normalizePeriodUnit(periodUnit: string | undefined): string {
    switch ((periodUnit || '').toUpperCase()) {
        case 'DAY':
            return 'day';
        case 'WEEK':
            return 'week';
        case 'MONTH':
            return 'month';
        case 'YEAR':
            return 'year';
        default:
            return 'period';
    }
}

type PaywallOffering = {
    monthly: PurchasesPackage | null | undefined;
    annual: PurchasesPackage | null | undefined;
    lifetime: PurchasesPackage | null | undefined;
};

export function getSelectedPackage(
    offering: PaywallOffering | null,
    billingPeriod: BillingPeriod,
): PurchasesPackage | null {
    if (!offering) return null;
    return offering[billingPeriod] ?? null;
}

export function getAvailableBillingPeriods(offering: PaywallOffering | null): BillingPeriod[] {
    if (!offering) return [];
    return BILLING_PERIODS.filter(period => Boolean(offering[period]));
}

export function getDefaultBillingPeriod(offering: PaywallOffering | null): BillingPeriod | null {
    if (offering?.annual) return 'annual';
    if (offering?.monthly) return 'monthly';
    if (offering?.lifetime) return 'lifetime';
    return null;
}

export function getBillingPeriodUnit(billingPeriod: BillingPeriod): '/month' | '/year' | null {
    if (billingPeriod === 'monthly') return '/month';
    if (billingPeriod === 'annual') return '/year';
    return null;
}

export function getTrialBadgeText(
    selectedPackage: PurchasesPackage | null,
    billingPeriod?: BillingPeriod,
): string | null {
    if (billingPeriod === 'lifetime') return null;
    const introPrice = selectedPackage?.product.introPrice;
    if (!introPrice) return null;

    const units = introPrice.periodNumberOfUnits;
    const unit = normalizePeriodUnit(introPrice.periodUnit);
    const pluralizedUnit = units === 1 ? unit : `${unit}s`;

    if (introPrice.price === 0) {
        return `${units}-${pluralizedUnit} free trial`;
    }

    return `${introPrice.priceString} for ${units} ${pluralizedUnit}`;
}

export function getTrialCtaText(
    selectedPackage: PurchasesPackage | null,
    fallback: string,
    billingPeriod?: BillingPeriod,
): string {
    if (billingPeriod === 'lifetime') return fallback;
    const introPrice = selectedPackage?.product.introPrice;
    if (!introPrice) return fallback;

    const units = introPrice.periodNumberOfUnits;
    const unit = normalizePeriodUnit(introPrice.periodUnit);
    const pluralizedUnit = units === 1 ? unit : `${unit}s`;

    if (introPrice.price === 0) {
        return `Start ${units}-${pluralizedUnit} Free Trial`;
    }

    return `Start Offer`;
}
