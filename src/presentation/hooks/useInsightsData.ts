import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useStreaks } from '../../infrastructure/auth/StreakContext';
import { useKhatma } from '../../infrastructure/khatma/KhatmaContext';
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
    const { totalPagesRead, completedJuz } = useKhatma();
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
            if (__DEV__) console.error('Failed to fetch insight data:', error);
        } finally {
            setLoading(false);
        }
    }, [recordingRepo, noteRepo]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData]),
    );

    // 1. Calculate Activity (Last 7 Days) — includes Khatma reading estimate
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
            if (activityMap.has(dateStr)) {
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

        // Add Khatma reading estimate for today (~2 min/page)
        if (totalPagesRead > 0) {
            const todayStr = today.toISOString().split('T')[0];
            if (activityMap.has(todayStr)) {
                // Estimate: average pages across active days, ~2 min/page
                const activeDays = Math.max(1, completedJuz.length);
                const avgPagesPerDay = Math.ceil(totalPagesRead / activeDays);
                const readingMins = avgPagesPerDay * 2;
                activityMap.set(todayStr, (activityMap.get(todayStr) || 0) + readingMins);
            }
        }

        // Map back to result array
        return result.map(item => ({
            label: item.label,
            value: activityMap.get(item.date) || 0,
        }));
    };

    // 2. Heatmap Data — merge streak activityHistory with Khatma reading days
    const getHeatmapData = () => {
        const heatmap = new Map<string, number>();

        // Add streak activity history
        if (streak?.activityHistory) {
            for (const [date, count] of Object.entries(streak.activityHistory)) {
                heatmap.set(date, (heatmap.get(date) || 0) + count);
            }
        }

        // Add Khatma reading days (each completed juz = activity on that day)
        // Generate entries for days the user has been active this month
        if (completedJuz.length > 0 || totalPagesRead > 0) {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            // Mark days corresponding to completed Juz as active
            for (const juzNum of completedJuz) {
                // Use a deterministic date for each completed Juz
                const d = new Date(year, month, Math.min(juzNum, new Date(year, month + 1, 0).getDate()));
                const dateStr = d.toISOString().split('T')[0];
                if (!heatmap.has(dateStr)) {
                    heatmap.set(dateStr, 3);
                }
            }
        }

        return Array.from(heatmap.entries()).map(([date, count]) => ({
            date,
            count,
        }));
    };

    // 3. Topic Breakdown — include Khatma reading as "Reading" category
    const getTopicBreakdown = () => {
        // Include Khatma pages read as a "reading" activity unit
        const khatmaReadingUnits = Math.max(completedJuz.length, Math.floor(totalPagesRead / 20));
        const totalItems = khatmaReadingUnits + (streak?.totalReflections || 0) + recordings.length + notes.length;

        if (totalItems === 0)
            return [
                { value: 1, color: Colors.chartEmpty, text: '0%', label: 'None' },
            ];

        const readingPct = Math.round((khatmaReadingUnits / totalItems) * 100);
        const recitingPct = Math.round((recordings.length / totalItems) * 100);
        const reflectionPct = Math.round(((notes.length + (streak?.totalReflections || 0)) / totalItems) * 100);

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
        ].filter(item => item.value > 0);
    };

    // 4. Total Stats — include Khatma reading time
    const getTotalTime = () => {
        const recordingSeconds = recordings.reduce((acc, r) => acc + (r.duration || 0), 0);
        const noteSeconds = notes.length * 5 * 60; // 5 mins per note
        const khatmaSeconds = totalPagesRead * 2 * 60; // ~2 min per page
        return Math.round((recordingSeconds + noteSeconds + khatmaSeconds) / 60);
    };

    return {
        dailyActivity: getDailyActivity(),
        heatmapData: getHeatmapData(),
        topicBreakdown: getTopicBreakdown(),
        stats: {
            currentStreak: streak?.currentStreak || 0,
            totalTimeMinutes: getTotalTime(),
            versesRead: Math.max(streak?.totalReflections || 0, totalPagesRead),
            recordingsCount: recordings.length,
            favoritesCount: completedJuz.length,
        },
        loading,
    };
};
