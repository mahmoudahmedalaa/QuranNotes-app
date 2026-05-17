import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../../core/firebase/config';
import { DEFAULT_PAYWALL_ROLLOUT_CONFIG, PaywallRolloutConfig } from '../domain/SubscriptionAccessPolicy';

const CACHE_KEY = '@paywall_rollout_config';

function normalizeConfig(data: Partial<PaywallRolloutConfig> | undefined | null): PaywallRolloutConfig {
    return {
        enabled: typeof data?.enabled === 'boolean'
            ? data.enabled
            : DEFAULT_PAYWALL_ROLLOUT_CONFIG.enabled,
        grandfatherBefore: data?.grandfatherBefore || DEFAULT_PAYWALL_ROLLOUT_CONFIG.grandfatherBefore,
        rolloutVersion: typeof data?.rolloutVersion === 'number'
            ? data.rolloutVersion
            : DEFAULT_PAYWALL_ROLLOUT_CONFIG.rolloutVersion,
    };
}

let onConfigChanged: ((config: PaywallRolloutConfig) => void) | null = null;

export const PaywallRolloutConfigService = {
    setOnConfigChanged(callback: ((config: PaywallRolloutConfig) => void) | null) {
        onConfigChanged = callback;
    },

    async fetch(): Promise<PaywallRolloutConfig> {
        try {
            const doc = await db.collection('config').doc('paywallRollout').get();

            if (doc.exists) {
                const config = normalizeConfig(doc.data() as Partial<PaywallRolloutConfig>);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config));
                return config;
            }
        } catch {
            if (__DEV__) console.log('[PaywallRolloutConfig] Firestore fetch failed, using cache');
        }

        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);

            if (cached) {
                return normalizeConfig(JSON.parse(cached) as Partial<PaywallRolloutConfig>);
            }
        } catch {
            if (__DEV__) console.log('[PaywallRolloutConfig] Cache read failed');
        }

        return DEFAULT_PAYWALL_ROLLOUT_CONFIG;
    },

    listen(): () => void {
        return db.collection('config').doc('paywallRollout').onSnapshot(
            (doc) => {
                const config = doc.exists
                    ? normalizeConfig(doc.data() as Partial<PaywallRolloutConfig>)
                    : DEFAULT_PAYWALL_ROLLOUT_CONFIG;

                AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config)).catch(() => { });
                onConfigChanged?.(config);

                if (__DEV__) {
                    console.log('[PaywallRolloutConfig] Live update:', config);
                }
            },
            (error) => {
                if (__DEV__) {
                    console.log('[PaywallRolloutConfig] Listener error:', error.message);
                }
            },
        );
    },
};
