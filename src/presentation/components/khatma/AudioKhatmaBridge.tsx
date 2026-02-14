/**
 * AudioKhatmaBridge — Connects audio playback to Khatma progress tracking
 * 
 * This component sits inside both AudioProvider and KhatmaProvider and
 * automatically records page reads whenever audio advances to a new verse,
 * regardless of which screen the user is on.
 * 
 * Also updates ReadingPositionService so "Continue Reading" follows the player
 * even when the user is not on the surah screen.
 */
import React, { useEffect, useRef } from 'react';
import { useAudio } from '../../../infrastructure/audio/AudioContext';
import { useKhatma } from '../../../infrastructure/khatma/KhatmaContext';
import { ReadingPositionService } from '../../../infrastructure/reading/ReadingPositionService';

export const AudioKhatmaBridge: React.FC = () => {
    const { playingVerse, playlist, currentSurahNum, currentSurahName, lastCompletedPlayback } = useAudio();
    const { recordPageRead, completedJuz } = useKhatma();
    const lastRecordedRef = useRef<string | null>(null);
    // Track the highest verse seen per surah to only advance forward
    const highestVerseRef = useRef<{ surah: number; verse: number } | null>(null);

    // Clear dedup ref when Khatma progress changes (e.g. toggling Juz off,
    // resetting, or starting a new round) so the current verse gets re-recorded
    useEffect(() => {
        lastRecordedRef.current = null;
    }, [completedJuz.length]);

    // Reset highest verse tracking when surah changes
    useEffect(() => {
        if (currentSurahNum) {
            if (!highestVerseRef.current || highestVerseRef.current.surah !== currentSurahNum) {
                highestVerseRef.current = { surah: currentSurahNum, verse: 0 };
            }
        }
    }, [currentSurahNum]);

    // Per-verse tracking — fires on each verse change during playback
    useEffect(() => {
        if (!playingVerse || !currentSurahNum || playlist.length === 0) return;

        // Build a unique key to avoid duplicate recordings
        const key = `${playingVerse.surah}-${playingVerse.verse}`;
        if (lastRecordedRef.current === key) return;

        // Find the verse in the playlist to get its page number
        const verse = playlist.find((v: any) => v.number === playingVerse.verse);
        if (verse?.page) {
            recordPageRead(
                verse.page,
                currentSurahNum,
                verse.number,
                currentSurahName || undefined,
            );
            lastRecordedRef.current = key;
        }

        // Auto-advance reading position (forward only)
        const highest = highestVerseRef.current;
        if (!highest || highest.surah !== playingVerse.surah || playingVerse.verse > highest.verse) {
            highestVerseRef.current = { surah: playingVerse.surah, verse: playingVerse.verse };
            ReadingPositionService.save(playingVerse.surah, playingVerse.verse, currentSurahName || undefined);
        }
    }, [playingVerse, playlist, currentSurahNum, currentSurahName, recordPageRead]);

    // ── BATCH tracking: when audio queue finishes, record ALL pages ──
    // This is the global safety net — fires even if user left the Surah screen.
    // recordPageRead is idempotent (checks `includes`), so duplicates are harmless.
    useEffect(() => {
        if (!lastCompletedPlayback) return;
        for (const verse of lastCompletedPlayback.verses) {
            if (verse.page) {
                recordPageRead(
                    verse.page,
                    lastCompletedPlayback.surah,
                    verse.number,
                    undefined, // surahName not available here but optional
                );
            }
        }
        // Save final reading position to the last verse of the completed surah
        const lastVerse = lastCompletedPlayback.verses[lastCompletedPlayback.verses.length - 1];
        if (lastVerse) {
            ReadingPositionService.save(lastCompletedPlayback.surah, lastVerse.number, undefined);
        }
    }, [lastCompletedPlayback, recordPageRead]);

    // This component renders nothing — it's a pure side-effect bridge
    return null;
};

