import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { revenueCatService } from '../../payments/infrastructure/RevenueCatService';
import { useAuth } from './AuthContext';

// REAL PRO CONTEXT (RevenueCat)

interface ProContextType {
    isPro: boolean;
    loading: boolean;
    identityReady: boolean;
    restorePurchases: () => Promise<boolean>;
    checkStatus: () => Promise<boolean>;
}

const ProContext = createContext<ProContextType>({
    isPro: false,
    loading: true,
    identityReady: false,
    restorePurchases: async () => false,
    checkStatus: async () => false,
});

export const usePro = () => useContext(ProContext);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true); // Start loading until RevenueCat checked
    const [identityReady, setIdentityReady] = useState(false);
    const { user } = useAuth();
    const activeUserIdRef = useRef<string | null>(user?.id ?? null);
    activeUserIdRef.current = user?.id ?? null;

    const checkStatus = useCallback(async (): Promise<boolean> => {
        const targetUserId = activeUserIdRef.current;
        setLoading(true);
        setIsPro(false);
        setIdentityReady(false);

        if (!targetUserId) {
            setLoading(false);
            return false;
        }

        try {
            await revenueCatService.ensureUserIdentity(targetUserId);
            const customerInfo = await revenueCatService.getCustomerInfo();
            const proStatus = revenueCatService.isPro(customerInfo);
            if (activeUserIdRef.current !== targetUserId) return false;

            setIdentityReady(true);
            setIsPro(proStatus);
            return proStatus;
        } catch {
            if (activeUserIdRef.current !== targetUserId) return false;
            setIdentityReady(false);
            setIsPro(false);
            return false;
        } finally {
            if (activeUserIdRef.current === targetUserId) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const currentUserId = user?.id ?? null;
        let cancelled = false;

        setIsPro(false);
        setIdentityReady(false);
        setLoading(true);

        (async () => {
            if (currentUserId) {
                await checkStatus();
            } else {
                try {
                    await revenueCatService.logoutUser();
                } finally {
                    if (!cancelled && activeUserIdRef.current === null) setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id, checkStatus]);

    const restorePurchases = async (): Promise<boolean> => {
        const currentUserId = activeUserIdRef.current;
        setLoading(true);
        setIsPro(false);
        setIdentityReady(false);
        try {
            if (!currentUserId) return false;
            await revenueCatService.ensureUserIdentity(currentUserId);
            const restored = await revenueCatService.restorePurchases();
            if (!restored) return false;
            return await checkStatus();
        } catch {
            setIsPro(false);
            setIdentityReady(false);
            return false;
        } finally {
            if (activeUserIdRef.current === currentUserId) setLoading(false);
        }
    };

    return (
        <ProContext.Provider value={{ isPro, loading, identityReady, restorePurchases, checkStatus }}>
            {children}
        </ProContext.Provider>
    );
};
