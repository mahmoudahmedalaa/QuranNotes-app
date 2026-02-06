import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStreak, INITIAL_STREAK } from '../../domain/entities/UserStreak';
import { StreakService } from '../../application/services/StreakService';

const STORAGE_KEY = 'reflection_streaks';

export const useStreak = () => {
    const [streak, setStreak] = useState<UserStreak>(INITIAL_STREAK);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStreak();
    }, []);

    const loadStreak = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                let parsed: UserStreak = JSON.parse(data);
                // Validate if streak is still active
                parsed = StreakService.validateStreak(parsed, new Date());
                setStreak(parsed);
                // Update storage if validated (e.g. if it was reset)
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
        } catch (error) {
            console.error('Failed to load streak:', error);
        } finally {
            setLoading(false);
        }
    };

    const recordActivity = async () => {
        try {
            const newStreak = StreakService.calculateNewStreak(streak, new Date());
            setStreak(newStreak);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newStreak));
        } catch (error) {
            console.error('Failed to record activity:', error);
        }
    };

    return {
        streak,
        loading,
        recordActivity,
        refreshStreak: loadStreak,
    };
};
