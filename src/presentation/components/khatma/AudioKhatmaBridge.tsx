/**
 * AudioKhatmaBridge — Updates reading positions during audio playback.
 *
 * Two responsibilities:
 * 1. Always updates the GLOBAL ReadingPositionService (for home screen "Continue Reading")
 * 2. Only updates khatma-specific KhatmaReadingPosition when an active khatma session
 *    is set (i.e. user navigated from the Khatma tab). This prevents general Quran
 *    browsing from polluting Khatma "in progress" state.
 */
import React, { useEffect, useRef } from 'react';
import { useAudio } from '../../../infrastructure/audio/AudioContext';
import { ReadingPositionService } from '../../../infrastructure/reading/ReadingPositionService';
import { KhatmaReadingPosition } from '../../../infrastructure/khatma/KhatmaReadingPosition';

export const AudioKhatmaBridge: React.FC = () => {
    const { playingVerse, currentSurahNum, currentSurahName } = useAudio();
    const highestVerseRef = useRef<{ surah: number; verse: number } | null>(null);

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

            // 1. Always update GLOBAL reading position (for home screen, general tracking)
            ReadingPositionService.save(playingVerse.surah, playingVerse.verse, currentSurahName || undefined);

            // 2. Only update khatma-specific position if a khatma session is active
            const activeJuz = KhatmaReadingPosition.getActiveJuz();
            if (activeJuz !== null) {
                KhatmaReadingPosition.save(activeJuz, playingVerse.surah, playingVerse.verse);
            }
        }
    }, [playingVerse, currentSurahNum, currentSurahName]);

    return null;
};
