import React, { createContext, useContext, useEffect, useState } from 'react';
import { revenueCatService } from '../payments/RevenueCatService';

// REAL PRO CONTEXT (RevenueCat)

interface ProContextType {
    isPro: boolean;
    loading: boolean;
    restorePurchases: () => Promise<void>;
    checkStatus: () => Promise<void>;
    toggleDebugPro: () => void; // New Debug Method
}

const ProContext = createContext<ProContextType>({
    isPro: false,
    loading: false,
    restorePurchases: async () => { },
    checkStatus: async () => { },
    toggleDebugPro: () => { },
});

export const usePro = () => useContext(ProContext);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPro, setIsPro] = useState(false); // Default to FREE for now
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const customerInfo = await revenueCatService.getCustomerInfo();
            const isProStatus = revenueCatService.isPro(customerInfo);
            setIsPro(isProStatus);
        } catch (e) {
            console.error('Error checking pro status:', e);
        } finally {
            setLoading(false);
        }
    };

    const restorePurchases = async () => {
        setLoading(true);
        try {
            const isProStatus = await revenueCatService.restorePurchases();
            setIsPro(isProStatus);
        } catch (e) {
            console.error('Error restoring purchases:', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleDebugPro = () => {
        setIsPro(prev => !prev);
    };

    return (
        <ProContext.Provider value={{ isPro, loading, restorePurchases, checkStatus, toggleDebugPro }}>
            {children}
        </ProContext.Provider>
    );
};
