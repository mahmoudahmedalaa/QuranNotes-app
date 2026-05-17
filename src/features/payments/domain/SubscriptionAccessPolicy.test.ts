import {
    getSubscriptionAccessState,
    isGrandfatheredUser,
    PaywallRolloutConfig,
    StoredSubscriptionAccessState,
} from './SubscriptionAccessPolicy';
import { User } from '../../auth/domain/User';

const ENABLED_CONFIG: PaywallRolloutConfig = {
    enabled: true,
    grandfatherBefore: '2026-05-18T00:00:00.000Z',
    rolloutVersion: 2,
};

function buildUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user_1',
        email: 'user@example.com',
        displayName: 'Test User',
        isAnonymous: false,
        photoURL: null,
        createdAt: '2026-05-01T00:00:00.000Z',
        lastSignInAt: '2026-05-17T00:00:00.000Z',
        ...overrides,
    };
}

describe('SubscriptionAccessPolicy', () => {
    it('marks users created before the cutoff as grandfathered', () => {
        expect(isGrandfatheredUser(buildUser())).toBe(true);
    });

    it('does not grandfather users created after the cutoff', () => {
        const user = buildUser({ createdAt: '2026-05-20T00:00:00.000Z' });

        expect(isGrandfatheredUser(user)).toBe(false);
    });

    it('preserves access for legacy free users while rollout is disabled', () => {
        const access = getSubscriptionAccessState(buildUser(), false);

        expect(access.hasAccess).toBe(true);
        expect(access.requiresSubscription).toBe(false);
        expect(access.isGrandfathered).toBe(true);
    });

    it('preserves access for Pro users regardless of creation date', () => {
        const access = getSubscriptionAccessState(
            buildUser({ createdAt: '2026-05-20T00:00:00.000Z' }),
            true,
        );

        expect(access.hasAccess).toBe(true);
        expect(access.requiresSubscription).toBe(false);
    });

    it('requires a subscription for new free users when the rollout is enabled', () => {
        const access = getSubscriptionAccessState(
            buildUser({ createdAt: '2026-05-20T00:00:00.000Z' }),
            false,
            ENABLED_CONFIG,
        );

        expect(access.hasAccess).toBe(false);
        expect(access.requiresSubscription).toBe(true);
        expect(access.isGrandfathered).toBe(false);
        expect(access.rolloutVersion).toBe(2);
    });

    it('honors stored grandfathered access state over auth-derived cutoff logic', () => {
        const storedAccessState: StoredSubscriptionAccessState = {
            grandfathered: true,
            evaluatedAt: '2026-05-17T12:00:00.000Z',
            source: 'manual_override',
            rolloutVersion: 2,
            userCreatedAt: '2026-05-20T00:00:00.000Z',
        };

        const access = getSubscriptionAccessState(
            buildUser({ createdAt: '2026-05-20T00:00:00.000Z' }),
            false,
            ENABLED_CONFIG,
            storedAccessState,
        );

        expect(access.hasAccess).toBe(true);
        expect(access.requiresSubscription).toBe(false);
        expect(access.isGrandfathered).toBe(true);
    });
});
