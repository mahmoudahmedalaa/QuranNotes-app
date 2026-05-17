import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db } from '../../../core/firebase/config';

const LAST_SEEN_THROTTLE_MS = 12 * 60 * 60 * 1000;
const LAST_SEEN_CACHE_PREFIX = '@telemetry:last_seen:';

interface AppOpenPayload {
    isPro: boolean;
    isGrandfathered: boolean;
    rolloutVersion: number;
}

interface PaywallViewPayload {
    hardPaywall: boolean;
    location: 'onboarding' | 'modal' | 'ramadan';
    reason?: string;
}

interface SubscriptionEventPayload {
    location: 'onboarding' | 'modal' | 'ramadan';
    outcome: 'started' | 'success' | 'cancelled' | 'failed' | 'restored';
    hardPaywall: boolean;
    reason?: string;
    message?: string;
}

function summaryDoc(userId: string) {
    return db.collection('users').doc(userId).collection('metrics').doc('summary');
}

function eventCollection(userId: string) {
    return db.collection('users').doc(userId).collection('telemetry_events');
}

function appOpenCacheKey(userId: string) {
    return `${LAST_SEEN_CACHE_PREFIX}${userId}`;
}

async function shouldWriteLastSeen(userId: string): Promise<boolean> {
    const cacheKey = appOpenCacheKey(userId);
    const raw = await AsyncStorage.getItem(cacheKey);

    if (!raw) return true;

    const lastWrittenAt = Number(raw);
    if (Number.isNaN(lastWrittenAt)) return true;

    return (Date.now() - lastWrittenAt) >= LAST_SEEN_THROTTLE_MS;
}

async function markLastSeenWritten(userId: string): Promise<void> {
    await AsyncStorage.setItem(appOpenCacheKey(userId), String(Date.now()));
}

export const TelemetryService = {
    async trackAppOpen(userId: string, payload: AppOpenPayload): Promise<void> {
        if (!userId) return;

        if (!(await shouldWriteLastSeen(userId))) {
            return;
        }

        await summaryDoc(userId).set({
            lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSeenClientAt: new Date().toISOString(),
            appOpenCount: firebase.firestore.FieldValue.increment(1),
            lastKnownIsPro: payload.isPro,
            lastKnownGrandfathered: payload.isGrandfathered,
            lastRolloutVersion: payload.rolloutVersion,
        }, { merge: true });

        await markLastSeenWritten(userId);
    },

    async trackPaywallView(userId: string, payload: PaywallViewPayload): Promise<void> {
        if (!userId) return;

        const eventId = `paywall_view_${Date.now()}`;

        await Promise.all([
            summaryDoc(userId).set({
                lastPaywallViewAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastPaywallViewClientAt: new Date().toISOString(),
                paywallViewCount: firebase.firestore.FieldValue.increment(1),
                lastPaywallReason: payload.reason || null,
                lastPaywallLocation: payload.location,
                lastPaywallHardGate: payload.hardPaywall,
            }, { merge: true }),
            eventCollection(userId).doc(eventId).set({
                type: 'paywall_view',
                at: firebase.firestore.FieldValue.serverTimestamp(),
                clientAt: new Date().toISOString(),
                ...payload,
            }),
        ]);
    },

    async trackSubscriptionEvent(userId: string, payload: SubscriptionEventPayload): Promise<void> {
        if (!userId) return;

        const eventId = `subscription_${payload.outcome}_${Date.now()}`;

        await Promise.all([
            summaryDoc(userId).set({
                lastSubscriptionEventAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSubscriptionOutcome: payload.outcome,
                lastSubscriptionLocation: payload.location,
                lastSubscriptionReason: payload.reason || null,
                lastSubscriptionHardGate: payload.hardPaywall,
            }, { merge: true }),
            eventCollection(userId).doc(eventId).set({
                type: 'subscription_event',
                at: firebase.firestore.FieldValue.serverTimestamp(),
                clientAt: new Date().toISOString(),
                ...payload,
            }),
        ]);
    },

    async trackOnboardingCompleted(userId: string, skipped: boolean): Promise<void> {
        if (!userId) return;

        await summaryDoc(userId).set({
            onboardingCompletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            onboardingCompletedClientAt: new Date().toISOString(),
            onboardingSkipped: skipped,
        }, { merge: true });
    },
};
