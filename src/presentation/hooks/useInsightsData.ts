import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useStreaks } from '../../infrastructure/auth/StreakContext';
import { useRepositories } from '../../infrastructure/di/RepositoryContext';
import { Colors } from '../theme/DesignSystem';
import { Recording } from '../../domain/entities/Recording';
import { Note } from '../../domain/entities/Note';

export interface InsightMetrics {
    dailyActivity: { value: number; label: string }[];
    heatmapData: { date: string; count: number }[];
    topicBreakdown: {
        value: number;
        color: string;
        text: string;
        label?: string;
        focused?: boolean;
    }[];
    stats: {
        currentStreak: number;
        totalTimeMinutes: number;
        versesRead: number;
        recordingsCount: number;
        favoritesCount: number;
    };
    loading: boolean;
}

export const useInsightsData = (): InsightMetrics => {
    const { streak } = useStreaks();
    const { recordingRepo, noteRepo } = useRepositories();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [fetchedRecordings, fetchedNotes] = await Promise.all([
                recordingRepo.getAllRecordings(),
                noteRepo.getAllNotes(),
            ]);

            setRecordings(fetchedRecordings);
            setNotes(fetchedNotes);
        } catch (error) {
            console.error('Failed to fetch insight data:', error);
        } finally {
            setLoading(false);
        }
    }, [recordingRepo, noteRepo]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData]),
    );

    // 1. Calculate Activity (Last 7 Days)
    const getDailyActivity = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activityMap = new Map<string, number>();
        const today = new Date();
        const result: { date: string; label: string; value: number }[] = [];

        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = days[d.getDay()];

            activityMap.set(dateStr, 0);
            result.push({ date: dateStr, label: dayLabel, value: 0 });
        }

        // Sum durations (Recordings) - explicit duration
        recordings.forEach(r => {
            const dateStr = new Date(r.createdAt).toISOString().split('T')[0];
            // Only count if it falls within the last 7 days
            if (activityMap.has(dateStr)) {
                // Duration is in seconds, convert to minutes
                const mins = Math.round((r.duration || 0) / 60);
                activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + mins);
            }
        });

        // Sum durations (Notes) - implied 5 mins per note
        notes.forEach(n => {
            const dateStr = new Date(n.updatedAt).toISOString().split('T')[0];
            if (activityMap.has(dateStr)) {
                activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 5);
            }
        });

        // Map back to result array
        return result.map(item => ({
            label: item.label,
            value: activityMap.get(item.date) || 0,
        }));
    };

    // 2. Heatmap Data (from StreakContext)
    const getHeatmapData = () => {
        if (!streak || !streak.activityHistory) return [];
        return Object.entries(streak.activityHistory).map(([date, count]) => ({
            date,
            count,
        }));
    };

    // 3. Topic Breakdown
    const getTopicBreakdown = () => {
        // If no data, return empty state
        const totalItems = (streak?.totalReflections || 0) + recordings.length + notes.length;
        if (totalItems === 0)
            return [
                { value: 1, color: Colors.chartEmpty, text: '0%', label: 'None' }, // Empty state
            ];

        const readingPct = Math.round(((streak?.totalReflections || 0) / totalItems) * 100);
        const recitingPct = Math.round((recordings.length / totalItems) * 100);
        const reflectionPct = Math.round((notes.length / totalItems) * 100);

        return [
            {
                value: readingPct || 0,
                color: Colors.chartReading,
                text: `${readingPct}%`,
                label: 'Reading',
            },
            {
                value: recitingPct || 0,
                color: Colors.chartReciting,
                text: `${recitingPct}%`,
                label: 'Recitation',
                focused: recitingPct > 30,
            },
            {
                value: reflectionPct || 0,
                color: Colors.chartReflection,
                text: `${reflectionPct}%`,
                label: 'Reflection',
            },
        ].filter(item => item.value > 0); // Only show non-zero categories
    };

    // 4. Total Stats
    const getTotalTime = () => {
        const recordingSeconds = recordings.reduce((acc, r) => acc + (r.duration || 0), 0);
        const noteSeconds = notes.length * 5 * 60; // 5 mins per note
        return Math.round((recordingSeconds + noteSeconds) / 60); // Total Minutes
    };

    return {
        dailyActivity: getDailyActivity(),
        heatmapData: getHeatmapData(),
        topicBreakdown: getTopicBreakdown(),
        stats: {
            currentStreak: streak?.currentStreak || 0,
            totalTimeMinutes: getTotalTime(),
            versesRead: streak?.totalReflections || 0,
            recordingsCount: recordings.length,
            favoritesCount: 0,
        },
        loading,
    };
};
