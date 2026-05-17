import { User } from '../../auth/domain/User';

export interface PaywallRolloutConfig {
    enabled: boolean;
    grandfatherBefore: string;
    rolloutVersion: number;
}

export interface StoredSubscriptionAccessState {
    grandfathered: boolean;
    evaluatedAt: string;
    source: 'auth_creation_time' | 'manual_override';
    rolloutVersion: number;
    userCreatedAt: string | null;
}

export const DEFAULT_PAYWALL_ROLLOUT_CONFIG: PaywallRolloutConfig = {
    // Safety-first default. We can merge/test the rollout plumbing without
    // changing production behavior until we intentionally flip this switch.
    enabled: false,
    grandfatherBefore: '2026-05-18T00:00:00.000Z',
    rolloutVersion: 1,
};

export interface SubscriptionAccessState {
    hasAccess: boolean;
    requiresSubscription: boolean;
    isGrandfathered: boolean;
    rolloutEnabled: boolean;
    rolloutVersion: number;
}

function toTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

export function isGrandfatheredUser(
    user: User | null,
    config: PaywallRolloutConfig = DEFAULT_PAYWALL_ROLLOUT_CONFIG,
): boolean {
    if (!user?.createdAt) return false;

    const createdAt = toTimestamp(user.createdAt);
    const cutoff = toTimestamp(config.grandfatherBefore);

    if (createdAt === null || cutoff === null) return false;

    return createdAt < cutoff;
}

export function getSubscriptionAccessState(
    user: User | null,
    isPro: boolean,
    config: PaywallRolloutConfig = DEFAULT_PAYWALL_ROLLOUT_CONFIG,
    storedAccessState: StoredSubscriptionAccessState | null = null,
): SubscriptionAccessState {
    const isGrandfathered = storedAccessState?.grandfathered ?? isGrandfatheredUser(user, config);
    const rolloutEnabled = config.enabled;
    const requiresSubscription = rolloutEnabled && !!user && !isPro && !isGrandfathered;

    return {
        hasAccess: !requiresSubscription,
        requiresSubscription,
        isGrandfathered,
        rolloutEnabled,
        rolloutVersion: config.rolloutVersion,
    };
}
