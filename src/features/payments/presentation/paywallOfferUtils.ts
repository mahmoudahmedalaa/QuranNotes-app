import { PurchasesPackage } from '../infrastructure/RevenueCatService';

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

export function getSelectedPackage(offering: {
    monthly: PurchasesPackage | null | undefined;
    annual: PurchasesPackage | null | undefined;
} | null, isAnnual: boolean): PurchasesPackage | null {
    if (!offering) return null;
    return isAnnual ? offering.annual ?? null : offering.monthly ?? null;
}

export function getTrialBadgeText(selectedPackage: PurchasesPackage | null): string | null {
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

export function getTrialCtaText(selectedPackage: PurchasesPackage | null, fallback: string): string {
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
