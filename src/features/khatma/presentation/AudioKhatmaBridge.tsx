/**
 * AudioKhatmaBridge — Updates global reading position during audio playback
 * AND auto-completes surahs when the audio finishes playing all verses.
 *
 * Always updates the GLOBAL ReadingPositionService so that
 * the Khatma "Continue Reading" feature works correctly.
 */
import React, { useEffect, useRef } from 'react';
import { useAudio } from '../../audio-player/infrastructure/AudioContext';
import { useKhatma } from '../infrastructure/KhatmaContext';
import { ReadingPositionService } from '../../quran-reading/infrastructure/ReadingPositionService';
import { useAuth } from '../../auth/infrastructure/AuthContext';

export const AudioKhatmaBridge: React.FC = () => {
    const { playingVerse, currentSurahNum, currentSurahName, lastCompletedPlayback } = useAudio();
    const { markSurahComplete } = useKhatma();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const highestVerseRef = useRef<{ surah: number; verse: number } | null>(null);
    const lastHandledTimestamp = useRef<number>(0);

    // Reset highest verse tracking when surah changes
    useEffect(() => {
        if (currentSurahNum) {
            if (!highestVerseRef.current || highestVerseRef.current.surah !== currentSurahNum) {
                highestVerseRef.current = { surah: currentSurahNum, verse: 0 };
            }
        }
    }, [currentSurahNum]);

    // Auto-advance reading position (forward only)
    useEffect(() => {
        if (!playingVerse || !currentSurahNum) return;

        const highest = highestVerseRef.current;
        if (!highest || highest.surah !== playingVerse.surah || playingVerse.verse > highest.verse) {
            highestVerseRef.current = { surah: playingVerse.surah, verse: playingVerse.verse };

            // Update GLOBAL reading position (for home screen + Khatma continue reading)
            ReadingPositionService.save(playingVerse.surah, playingVerse.verse, currentSurahName || undefined, userId);
        }
    }, [playingVerse, currentSurahNum, currentSurahName, userId]);

    // Auto-complete surah when audio finishes the entire playlist
    useEffect(() => {
        if (!lastCompletedPlayback) return;
        if (lastCompletedPlayback.timestamp <= lastHandledTimestamp.current) return;

        // Mark this event as handled
        lastHandledTimestamp.current = lastCompletedPlayback.timestamp;

        // Auto-mark the surah as complete in Khatma
        markSurahComplete(lastCompletedPlayback.surah);

        if (__DEV__) {
            if (__DEV__) console.log(`[AudioKhatmaBridge] Auto-completed surah ${lastCompletedPlayback.surah}`);
        }
    }, [lastCompletedPlayback, markSurahComplete]);

    return null;
};
