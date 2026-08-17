import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Recording } from '../domain/entities/Recording';
import { useStreaks } from '../../features/auth/infrastructure/StreakContext';
import { usePro } from '../../features/auth/infrastructure/ProContext';
import { useAuth } from '../../features/auth/infrastructure/AuthContext';

import { LocalRecordingRepository } from '../data/local/LocalRecordingRepository';

export const useRecordingStorage = () => {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const { recordActivity } = useStreaks();
    const { isPro } = usePro();
    const { user } = useAuth();
    const repo = useMemo(() => new LocalRecordingRepository(user?.id ?? null), [user?.id]);
    const router = useRouter();

    const loadRecordings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await repo.getAllRecordings();
            setRecordings(data);
        } catch (error) {
            if (__DEV__) console.error('Failed to load recordings:', error);
        } finally {
            setLoading(false);
        }
    }, [repo]);

    useEffect(() => {
        loadRecordings();
    }, [loadRecordings]);

    const saveRecording = async (recording: Recording) => {
        // GATING LOGIC: Limit Free users to 5 recordings
        const isUpdate = recordings.some(r => r.id === recording.id);

        if (!isPro && !isUpdate && recordings.length >= 5) {
            Alert.alert(
                'Recording Limit Reached',
                'Free users can create up to 5 voice recordings. Upgrade to Pro for unlimited recordings.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Upgrade to Pro', onPress: () => router.push('/paywall?reason=recordings') }
                ]
            );
            return;
        }

        try {
            const newRecording = {
                ...recording,
                id: recording.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
            await repo.saveRecording(newRecording);
            await loadRecordings();
            await recordActivity(); // Update streak
            return newRecording;
        } catch (error) {
            if (__DEV__) console.error('Failed to save recording:', error);
            throw error;
        }
    };

    const deleteRecording = async (id: string) => {
        try {
            await repo.deleteRecording(id);
            await loadRecordings();
        } catch (error) {
            if (__DEV__) console.error('Failed to delete recording:', error);
        }
    };

    return {
        recordings,
        loading,
        saveRecording,
        deleteRecording,
        refreshRecordings: loadRecordings,
    };
};
