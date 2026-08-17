import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { UserStreak, INITIAL_STREAK } from '../domain/entities/UserStreak';
import { StreakService } from '../application/services/StreakService';
import { ReviewService } from '../services/ReviewService';
import { CloudSyncEvents } from '../application/services/CloudSyncEvents';
import { useAuth } from '../../features/auth/infrastructure/AuthContext';
import { UserScopedStorage } from '../storage/UserScopedStorage';

const STORAGE_KEY = 'reflection_streaks';

export const useStreak = () => {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [streak, setStreak] = useState<UserStreak>(INITIAL_STREAK);
    const [loading, setLoading] = useState(true);

    const loadStreak = useCallback(async () => {
        setLoading(true);
        try {
            if (!userId) {
                setStreak(INITIAL_STREAK);
                return;
            }
            const data = await UserScopedStorage.getItem(STORAGE_KEY, userId);
            if (data) {
                let parsed: UserStreak = JSON.parse(data);
                // Validate if streak is still active
                parsed = StreakService.validateStreak(parsed, new Date());
                setStreak(parsed);
                // Update storage if validated (e.g. if it was reset)
                await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify(parsed));
            } else {
                setStreak(INITIAL_STREAK);
            }
        } catch (error) {
            if (__DEV__) console.error('Failed to load streak:', error);
            setStreak(INITIAL_STREAK);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadStreak();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                loadStreak();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [loadStreak]);

    // Re-read when cloud sync pulls remote data
    useEffect(() => {
        return CloudSyncEvents.onPull(() => { loadStreak(); });
    }, [loadStreak]);

    const recordActivity = async () => {
        try {
            if (!userId) return;
            const newStreak = StreakService.calculateNewStreak(streak, new Date());
            setStreak(newStreak);
            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify(newStreak));

            // Trigger review prompt at reading streak milestones (7, 14, 30)
            ReviewService.onReadingStreakUpdate(newStreak.currentStreak);
        } catch (error) {
            if (__DEV__) console.error('Failed to record activity:', error);
        }
    };

    return {
        streak,
        loading,
        recordActivity,
        refreshStreak: loadStreak,
    };
};
