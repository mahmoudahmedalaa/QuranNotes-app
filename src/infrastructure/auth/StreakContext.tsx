import React, { createContext, useContext } from 'react';
import { useStreak } from '../../presentation/hooks/useStreak';
import { UserStreak } from '../../domain/entities/UserStreak';

interface StreakContextType {
    streak: UserStreak;
    loading: boolean;
    recordActivity: () => Promise<void>;
    refreshStreak: () => Promise<void>;
}

const StreakContext = createContext<StreakContextType | undefined>(undefined);

export const useStreaks = () => {
    const context = useContext(StreakContext);
    if (!context) throw new Error('useStreaks must be used within a StreakProvider');
    return context;
};

export const StreakProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const streakData = useStreak();

    return <StreakContext.Provider value={streakData}>{children}</StreakContext.Provider>;
};
