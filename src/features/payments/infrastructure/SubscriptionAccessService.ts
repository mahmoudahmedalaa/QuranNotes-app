import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../../../core/firebase/config';
import { User } from '../../auth/domain/User';
import {
    DEFAULT_PAYWALL_ROLLOUT_CONFIG,
    isGrandfatheredUser,
    PaywallRolloutConfig,
    StoredSubscriptionAccessState,
} from '../domain/SubscriptionAccessPolicy';

function accessDoc(userId: string) {
    return db.collection('users').doc(userId).collection('access').doc('state');
}

function normalizeAccessState(
    data: Partial<StoredSubscriptionAccessState> | undefined | null,
): StoredSubscriptionAccessState | null {
    if (!data) return null;

    if (typeof data.grandfathered !== 'boolean') return null;

    return {
        grandfathered: data.grandfathered,
        evaluatedAt: data.evaluatedAt || new Date().toISOString(),
        source: data.source === 'manual_override' ? 'manual_override' : 'auth_creation_time',
        rolloutVersion: typeof data.rolloutVersion === 'number'
            ? data.rolloutVersion
            : DEFAULT_PAYWALL_ROLLOUT_CONFIG.rolloutVersion,
        userCreatedAt: data.userCreatedAt ?? null,
    };
}

export const SubscriptionAccessService = {
    async get(userId: string): Promise<StoredSubscriptionAccessState | null> {
        const doc = await accessDoc(userId).get();

        if (!doc.exists) return null;

        return normalizeAccessState(doc.data() as Partial<StoredSubscriptionAccessState>);
    },

    async ensure(user: User, config: PaywallRolloutConfig): Promise<StoredSubscriptionAccessState> {
        const existing = await this.get(user.id);

        if (existing) {
            return existing;
        }

        const state: StoredSubscriptionAccessState = {
            grandfathered: isGrandfatheredUser(user, config),
            evaluatedAt: new Date().toISOString(),
            source: 'auth_creation_time',
            rolloutVersion: config.rolloutVersion,
            userCreatedAt: user.createdAt,
        };

        await accessDoc(user.id).set(state, { merge: true });
        return state;
    },

    async markGrandfathered(userId: string, reason: string): Promise<void> {
        await accessDoc(userId).set({
            grandfathered: true,
            evaluatedAt: new Date().toISOString(),
            source: 'manual_override',
            overrideReason: reason,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    },
};
