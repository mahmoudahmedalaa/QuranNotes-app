import { usePaywallContext } from './PaywallContext';

export function useSubscriptionAccess() {
    const { accessState, loading } = usePaywallContext();

    return {
        ...accessState,
        isLoading: loading,
    };
}
