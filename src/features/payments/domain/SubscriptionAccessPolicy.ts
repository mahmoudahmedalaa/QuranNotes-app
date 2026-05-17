import { User } from '../../auth/domain/User';

export const HARD_PAYWALL_CONFIG = {
    // Safety-first default. We can merge/test the rollout plumbing without
    // changing production behavior until we intentionally flip this switch.
    enabled: false,
    grandfatherBefore: '2026-05-18T00:00:00.000Z',
} as const;

export interface SubscriptionAccessState {
    hasAccess: boolean;
    requiresSubscription: boolean;
    isGrandfathered: boolean;
    rolloutEnabled: boolean;
}

function toTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

export function isGrandfatheredUser(user: User | null): boolean {
    if (!user?.createdAt) return false;

    const createdAt = toTimestamp(user.createdAt);
    const cutoff = toTimestamp(HARD_PAYWALL_CONFIG.grandfatherBefore);

    if (createdAt === null || cutoff === null) return false;

    return createdAt < cutoff;
}

export function getSubscriptionAccessState(user: User | null, isPro: boolean): SubscriptionAccessState {
    const isGrandfathered = isGrandfatheredUser(user);
    const rolloutEnabled = HARD_PAYWALL_CONFIG.enabled;
    const requiresSubscription = rolloutEnabled && !!user && !isPro && !isGrandfathered;

    return {
        hasAccess: !requiresSubscription,
        requiresSubscription,
        isGrandfathered,
        rolloutEnabled,
    };
}
