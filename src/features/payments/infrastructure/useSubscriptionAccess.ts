import { useMemo } from 'react';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { usePro } from '../../auth/infrastructure/ProContext';
import { getSubscriptionAccessState } from '../domain/SubscriptionAccessPolicy';

export function useSubscriptionAccess() {
    const { user, loading: authLoading } = useAuth();
    const { isPro, loading: proLoading } = usePro();

    const access = useMemo(
        () => getSubscriptionAccessState(user, isPro),
        [user, isPro],
    );

    return {
        ...access,
        isLoading: authLoading || proLoading,
    };
}
