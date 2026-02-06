import { useEffect } from 'react';
import { useAuth } from '../../infrastructure/auth/AuthContext';
import { SyncService } from '../../application/services/SyncService';

export const useSync = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (user && !user.isAnonymous) {
            const syncService = new SyncService(user.id);
            syncService.syncAll();
            // Optional: Set up interval for background sync
            const interval = setInterval(() => syncService.syncAll(), 10 * 60 * 1000); // 10 mins
            return () => clearInterval(interval);
        }
    }, [user]);
};
