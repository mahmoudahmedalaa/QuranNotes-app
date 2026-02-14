/**
 * AudioContext — Global audio state provider
 * Lifts audio playback state from local hook to app-wide context.
 * Audio continues playing across screen navigation.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AudioPlayerService, PlaybackStatus } from './AudioPlayerService';
import { Surah, Verse } from '../../domain/entities/Quran';
import { useSettings } from '../settings/SettingsContext';
import { getReciterById } from '../../domain/entities/Reciter';

// Singleton player instance (shared across the app)
const player = new AudioPlayerService();

interface AudioContextType {
    playingVerse: { surah: number; verse: number } | null;
    isPlaying: boolean;
    currentSurahNum: number | null;
    currentSurahName: string | null;
    playlist: Verse[];
    playVerse: (surahNum: number, verseNum: number, surah?: Surah) => Promise<void>;
    playSurah: (surah: Surah) => Promise<void>;
    playFromVerse: (surah: Surah, verseNum: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = (): AudioContextType => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('useAudio must be used within AudioProvider');
    return ctx;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings } = useSettings();
    const [playingVerse, setPlayingVerse] = useState<{ surah: number; verse: number } | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSurahName, setCurrentSurahName] = useState<string | null>(null);

    // Playlist State
    const [playlist, setPlaylist] = useState<Verse[]>([]);
    const [currentSurahNum, setCurrentSurahNum] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState<number>(-1);

    // ── Refs to prevent stale closures in handleNextVerse ──
    // These are kept in sync with state and used in callbacks
    // so that rapid verse transitions always see latest values.
    const playlistRef = useRef<Verse[]>([]);
    const currentIndexRef = useRef<number>(-1);
    const currentSurahNumRef = useRef<number | null>(null);
    const currentSurahNameRef = useRef<string | null>(null);

    // Keep refs in sync with state
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { currentSurahNumRef.current = currentSurahNum; }, [currentSurahNum]);
    useEffect(() => { currentSurahNameRef.current = currentSurahName; }, [currentSurahName]);

    // Ref to track previous reciter for live switching
    const prevReciterRef = useRef(settings.reciterId);

    // Get cdnFolder for current reciter
    const getCdnFolder = useCallback(() => {
        const reciter = getReciterById(settings.reciterId);
        return reciter.cdnFolder;
    }, [settings.reciterId]);

    // Live reciter switch
    useEffect(() => {
        if (prevReciterRef.current !== settings.reciterId && playingVerse && isPlaying) {
            const cdnFolder = getReciterById(settings.reciterId).cdnFolder;
            player.playVerse(playingVerse.surah, playingVerse.verse, cdnFolder);
        }
        prevReciterRef.current = settings.reciterId;
    }, [settings.reciterId, playingVerse, isPlaying]);

    // Handle next verse when current finishes
    // Uses refs instead of state to avoid stale closures
    const handleNextVerse = useCallback(() => {
        const pl = playlistRef.current;
        const idx = currentIndexRef.current;
        const surahNum = currentSurahNumRef.current;

        if (pl.length > 0 && idx < pl.length - 1 && surahNum) {
            const nextIndex = idx + 1;
            const nextVerse = pl[nextIndex];
            setPlayingVerse({ surah: surahNum, verse: nextVerse.number });
            setCurrentIndex(nextIndex);
            currentIndexRef.current = nextIndex; // update ref immediately too
            const cdnFolder = getCdnFolder();
            player.playVerse(surahNum, nextVerse.number, cdnFolder);
        } else {
            // End of playlist
            setPlayingVerse(null);
            setCurrentIndex(-1);
            currentIndexRef.current = -1;
            setPlaylist([]);
            playlistRef.current = [];
            setCurrentSurahNum(null);
            currentSurahNumRef.current = null;
            setCurrentSurahName(null);
            currentSurahNameRef.current = null;
        }
    }, [getCdnFolder]);

    useEffect(() => {
        const unsubscribe = player.addListener((status: PlaybackStatus) => {
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
                // Minimal delay — just enough for state to settle
                setTimeout(() => handleNextVerse(), 10);
            }
        });
        return unsubscribe;
    }, [handleNextVerse]);

    // Play a specific verse
    const playVerse = useCallback(
        async (surahNum: number, verseNum: number, surah?: Surah) => {
            await player.stop();

            if (surah) {
                const startIndex = surah.verses.findIndex(v => v.number === verseNum);
                if (startIndex >= 0) {
                    setPlaylist(surah.verses);
                    playlistRef.current = surah.verses;
                    setCurrentSurahNum(surah.number);
                    currentSurahNumRef.current = surah.number;
                    setCurrentSurahName(surah.englishName || surah.name);
                    currentSurahNameRef.current = surah.englishName || surah.name;
                    setCurrentIndex(startIndex);
                    currentIndexRef.current = startIndex;
                }
            } else if (currentSurahNumRef.current === surahNum && playlistRef.current.length > 0) {
                const startIndex = playlistRef.current.findIndex(v => v.number === verseNum);
                if (startIndex >= 0) {
                    setCurrentIndex(startIndex);
                    currentIndexRef.current = startIndex;
                }
            }

            setPlayingVerse({ surah: surahNum, verse: verseNum });
            const cdnFolder = getCdnFolder();
            await player.playVerse(surahNum, verseNum, cdnFolder);
        },
        [getCdnFolder],
    );

    // Play entire surah from beginning
    const playSurah = useCallback(
        async (surah: Surah) => {
            await player.stop();

            setPlaylist(surah.verses);
            playlistRef.current = surah.verses;
            setCurrentSurahNum(surah.number);
            currentSurahNumRef.current = surah.number;
            setCurrentSurahName(surah.englishName || surah.name);
            currentSurahNameRef.current = surah.englishName || surah.name;
            setCurrentIndex(0);
            currentIndexRef.current = 0;

            if (surah.verses.length > 0) {
                setPlayingVerse({ surah: surah.number, verse: surah.verses[0].number });
                const cdnFolder = getCdnFolder();
                await player.playVerse(surah.number, surah.verses[0].number, cdnFolder);
            }
        },
        [getCdnFolder],
    );

    // Play from a specific verse within a surah
    const playFromVerse = useCallback(
        async (surah: Surah, verseNum: number) => {
            await player.stop();

            const startIndex = surah.verses.findIndex(v => v.number === verseNum);
            if (startIndex >= 0) {
                setPlaylist(surah.verses);
                playlistRef.current = surah.verses;
                setCurrentSurahNum(surah.number);
                currentSurahNumRef.current = surah.number;
                setCurrentSurahName(surah.englishName || surah.name);
                currentSurahNameRef.current = surah.englishName || surah.name;
                setCurrentIndex(startIndex);
                currentIndexRef.current = startIndex;
                setPlayingVerse({ surah: surah.number, verse: verseNum });
                const cdnFolder = getCdnFolder();
                await player.playVerse(surah.number, verseNum, cdnFolder);
            }
        },
        [getCdnFolder],
    );

    const pause = useCallback(async () => {
        setIsPlaying(false);
        await player.pause();
    }, []);

    const resume = useCallback(async () => {
        setIsPlaying(true);
        await player.resume();
    }, []);

    const stop = useCallback(async () => {
        setIsPlaying(false);
        setPlayingVerse(null);
        await player.stop();
        setPlaylist([]);
        playlistRef.current = [];
        setCurrentIndex(-1);
        currentIndexRef.current = -1;
        setCurrentSurahNum(null);
        currentSurahNumRef.current = null;
        setCurrentSurahName(null);
        currentSurahNameRef.current = null;
    }, []);

    const value: AudioContextType = {
        playingVerse,
        isPlaying,
        currentSurahNum,
        currentSurahName,
        playlist,
        playVerse,
        playSurah,
        playFromVerse,
        pause,
        resume,
        stop,
    };

    return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
