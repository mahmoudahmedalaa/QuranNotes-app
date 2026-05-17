import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { usePro } from '../../auth/infrastructure/ProContext';
import {
    DEFAULT_PAYWALL_ROLLOUT_CONFIG,
    getSubscriptionAccessState,
    PaywallRolloutConfig,
    StoredSubscriptionAccessState,
    SubscriptionAccessState,
} from '../domain/SubscriptionAccessPolicy';
import { PaywallRolloutConfigService } from './PaywallRolloutConfigService';
import { SubscriptionAccessService } from './SubscriptionAccessService';
import { TelemetryService } from './TelemetryService';

interface PaywallContextType {
    config: PaywallRolloutConfig;
    accessState: SubscriptionAccessState;
    storedAccessState: StoredSubscriptionAccessState | null;
    loading: boolean;
    refreshAccessState: () => Promise<void>;
}

const PaywallContext = createContext<PaywallContextType | null>(null);

export function usePaywallContext() {
    const context = useContext(PaywallContext);

    if (!context) {
        throw new Error('usePaywallContext must be used within a PaywallProvider');
    }

    return context;
}

export function PaywallProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { isPro, loading: proLoading } = usePro();
    const [config, setConfig] = useState<PaywallRolloutConfig>(DEFAULT_PAYWALL_ROLLOUT_CONFIG);
    const [configLoading, setConfigLoading] = useState(true);
    const [accessLoading, setAccessLoading] = useState(true);
    const [storedAccessState, setStoredAccessState] = useState<StoredSubscriptionAccessState | null>(null);
    const lastTelemetryKeyRef = useRef<string | null>(null);

    useEffect(() => {
        let mounted = true;

        PaywallRolloutConfigService.setOnConfigChanged((nextConfig) => {
            if (mounted) {
                setConfig(nextConfig);
                setConfigLoading(false);
            }
        });

        PaywallRolloutConfigService.fetch()
            .then((initialConfig) => {
                if (mounted) {
                    setConfig(initialConfig);
                }
            })
            .finally(() => {
                if (mounted) {
                    setConfigLoading(false);
                }
            });

        const unsubscribe = PaywallRolloutConfigService.listen();

        return () => {
            mounted = false;
            unsubscribe();
            PaywallRolloutConfigService.setOnConfigChanged(null);
        };
    }, []);

    useEffect(() => {
        lastTelemetryKeyRef.current = null;
    }, [user?.id]);

    const refreshAccessState = async () => {
        if (!user) {
            setStoredAccessState(null);
            setAccessLoading(false);
            return;
        }

        setAccessLoading(true);
        try {
            const nextState = await SubscriptionAccessService.ensure(user, config);
            setStoredAccessState(nextState);
        } catch (error) {
            if (__DEV__) {
                console.warn('[PaywallProvider] Failed to ensure access state:', error);
            }
            setStoredAccessState(null);
        } finally {
            setAccessLoading(false);
        }
    };

    useEffect(() => {
        refreshAccessState().catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, user?.createdAt, config.enabled, config.grandfatherBefore, config.rolloutVersion]);

    const accessState = useMemo(
        () => getSubscriptionAccessState(user, isPro, config, storedAccessState),
        [user, isPro, config, storedAccessState],
    );

    useEffect(() => {
        if (!user || authLoading || proLoading || configLoading || accessLoading) {
            return;
        }

        const track = async () => {
            const telemetryKey = [
                user.id,
                accessState.isGrandfathered ? 'grandfathered' : 'standard',
                isPro ? 'pro' : 'free',
                config.rolloutVersion,
            ].join(':');

            if (telemetryKey === lastTelemetryKeyRef.current) {
                return;
            }

            lastTelemetryKeyRef.current = telemetryKey;

            await TelemetryService.trackAppOpen(user.id, {
                isPro,
                isGrandfathered: accessState.isGrandfathered,
                rolloutVersion: config.rolloutVersion,
            });
        };

        track().catch(() => { });
    }, [user, authLoading, proLoading, configLoading, accessLoading, accessState.isGrandfathered, config.rolloutVersion, isPro]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState !== 'active' || !user) return;

            TelemetryService.trackAppOpen(user.id, {
                isPro,
                isGrandfathered: accessState.isGrandfathered,
                rolloutVersion: config.rolloutVersion,
            }).catch(() => { });
        });

        return () => {
            subscription.remove();
        };
    }, [user, isPro, accessState.isGrandfathered, config.rolloutVersion]);

    return (
        <PaywallContext.Provider
            value={{
                config,
                accessState,
                storedAccessState,
                loading: authLoading || proLoading || configLoading || accessLoading,
                refreshAccessState,
            }}>
            {children}
        </PaywallContext.Provider>
    );
}
