/**
 * AudioContext — Global audio state provider
 * Lifts audio playback state from local hook to app-wide context.
 * Audio continues playing across screen navigation.
 *
 * Uses react-native-track-player for native audio queue,
 * lock screen controls, and gapless playback.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AudioPlayerService, PlaybackStatus } from './AudioPlayerService';
import { Surah, Verse } from '../../domain/entities/Quran';
import { useSettings } from '../settings/SettingsContext';
import { getReciterById } from '../../domain/entities/Reciter';

// Singleton player instance (shared across the app)
const player = new AudioPlayerService();

/** Info about a completed playback session — used for batch Khatma tracking */
export interface CompletedPlayback {
    surah: number;
    verses: Verse[];
    timestamp: number;
}

interface AudioContextType {
    playingVerse: { surah: number; verse: number } | null;
    isPlaying: boolean;
    currentSurahNum: number | null;
    currentSurahName: string | null;
    playlist: Verse[];
    /** Populated when playback queue ends — Surah screen uses this to batch-record Khatma pages */
    lastCompletedPlayback: CompletedPlayback | null;
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
    const [lastCompletedPlayback, setLastCompletedPlayback] = useState<CompletedPlayback | null>(null);

    // Playlist State
    const [playlist, setPlaylist] = useState<Verse[]>([]);
    const [currentSurahNum, setCurrentSurahNum] = useState<number | null>(null);

    // ── Refs to prevent stale closures ──
    const playlistRef = useRef<Verse[]>([]);
    const currentSurahNumRef = useRef<number | null>(null);
    const currentSurahNameRef = useRef<string | null>(null);

    // Keep refs in sync with state
    useEffect(() => { playlistRef.current = playlist; }, [playlist]);
    useEffect(() => { currentSurahNumRef.current = currentSurahNum; }, [currentSurahNum]);
    useEffect(() => { currentSurahNameRef.current = currentSurahName; }, [currentSurahName]);

    // Ref to track previous reciter for live switching
    const prevReciterRef = useRef(settings.reciterId);

    // Get reciter info
    const getReciterInfo = useCallback(() => {
        const reciter = getReciterById(settings.reciterId);
        return { cdnFolder: reciter.cdnFolder, name: reciter.name };
    }, [settings.reciterId]);

    // Initialize player on mount
    useEffect(() => {
        player.setup().catch(e => console.warn('[AudioContext] Setup failed:', e));
    }, []);

    // Live reciter switch — reload current playlist with new reciter
    useEffect(() => {
        if (prevReciterRef.current !== settings.reciterId && playingVerse && isPlaying) {
            const pl = playlistRef.current;
            const surahNum = currentSurahNumRef.current;
            const surahName = currentSurahNameRef.current;
            if (pl.length > 0 && surahNum) {
                const currentIndex = pl.findIndex(v => v.number === playingVerse.verse);
                const { cdnFolder, name } = getReciterInfo();
                player.loadPlaylist(
                    surahNum,
                    pl,
                    currentIndex >= 0 ? currentIndex : 0,
                    cdnFolder,
                    name,
                    surahName || 'Quran',
                );
            }
        }
        prevReciterRef.current = settings.reciterId;
    }, [settings.reciterId, playingVerse, isPlaying, getReciterInfo]);

    // ── Listen to player events ──
    useEffect(() => {
        const unsubscribe = player.addListener((status: PlaybackStatus) => {
            setIsPlaying(status.isPlaying);

            // Track changed in the queue — update playingVerse from playlist
            if (status.activeTrackIndex !== undefined) {
                const pl = playlistRef.current;
                const surahNum = currentSurahNumRef.current;
                if (pl.length > 0 && surahNum && status.activeTrackIndex < pl.length) {
                    const verse = pl[status.activeTrackIndex];
                    setPlayingVerse({ surah: surahNum, verse: verse.number });
                }
            }

            // Queue ended — save completed playback info BEFORE clearing state
            if (status.didJustFinish) {
                const finishedSurah = currentSurahNumRef.current;
                const finishedPlaylist = playlistRef.current;
                if (finishedSurah && finishedPlaylist.length > 0) {
                    setLastCompletedPlayback({
                        surah: finishedSurah,
                        verses: [...finishedPlaylist],
                        timestamp: Date.now(),
                    });
                }
                setPlayingVerse(null);
                setPlaylist([]);
                playlistRef.current = [];
                setCurrentSurahNum(null);
                currentSurahNumRef.current = null;
                setCurrentSurahName(null);
                currentSurahNameRef.current = null;
            }
        });
        return unsubscribe;
    }, []);

    // Play a specific verse (with optional surah context for queue)
    const playVerse = useCallback(
        async (surahNum: number, verseNum: number, surah?: Surah) => {
            const { cdnFolder, name } = getReciterInfo();

            if (surah) {
                const startIndex = surah.verses.findIndex(v => v.number === verseNum);
                if (startIndex >= 0) {
                    setPlaylist(surah.verses);
                    playlistRef.current = surah.verses;
                    setCurrentSurahNum(surah.number);
                    currentSurahNumRef.current = surah.number;
                    const sName = surah.englishName || surah.name;
                    setCurrentSurahName(sName);
                    currentSurahNameRef.current = sName;
                    setPlayingVerse({ surah: surahNum, verse: verseNum });

                    await player.loadPlaylist(
                        surah.number,
                        surah.verses,
                        startIndex,
                        cdnFolder,
                        name,
                        sName,
                    );
                    return;
                }
            }

            // No surah context — try existing playlist
            if (currentSurahNumRef.current === surahNum && playlistRef.current.length > 0) {
                const startIndex = playlistRef.current.findIndex(v => v.number === verseNum);
                if (startIndex >= 0) {
                    setPlayingVerse({ surah: surahNum, verse: verseNum });
                    await player.skipToTrack(startIndex);
                    return;
                }
            }

            // Fallback: single verse playback — clear stale playlist state first
            // to prevent conflicts when switching from surah to mood verse
            if (playlistRef.current.length > 0) {
                await player.stop();
            }
            setPlaylist([]);
            playlistRef.current = [];
            setCurrentSurahNum(null);
            currentSurahNumRef.current = null;
            setCurrentSurahName(null);
            currentSurahNameRef.current = null;
            setPlayingVerse({ surah: surahNum, verse: verseNum });
            await player.playVerse(surahNum, verseNum, cdnFolder, name);
        },
        [getReciterInfo],
    );

    // Play entire surah from beginning
    const playSurah = useCallback(
        async (surah: Surah) => {
            setPlaylist(surah.verses);
            playlistRef.current = surah.verses;
            setCurrentSurahNum(surah.number);
            currentSurahNumRef.current = surah.number;
            const sName = surah.englishName || surah.name;
            setCurrentSurahName(sName);
            currentSurahNameRef.current = sName;

            if (surah.verses.length > 0) {
                setPlayingVerse({ surah: surah.number, verse: surah.verses[0].number });
                const { cdnFolder, name } = getReciterInfo();
                await player.loadPlaylist(
                    surah.number,
                    surah.verses,
                    0,
                    cdnFolder,
                    name,
                    sName,
                );
            }
        },
        [getReciterInfo],
    );

    // Play from a specific verse within a surah
    const playFromVerse = useCallback(
        async (surah: Surah, verseNum: number) => {
            const startIndex = surah.verses.findIndex(v => v.number === verseNum);
            if (startIndex >= 0) {
                setPlaylist(surah.verses);
                playlistRef.current = surah.verses;
                setCurrentSurahNum(surah.number);
                currentSurahNumRef.current = surah.number;
                const sName = surah.englishName || surah.name;
                setCurrentSurahName(sName);
                currentSurahNameRef.current = sName;
                setPlayingVerse({ surah: surah.number, verse: verseNum });
                const { cdnFolder, name } = getReciterInfo();
                await player.loadPlaylist(
                    surah.number,
                    surah.verses,
                    startIndex,
                    cdnFolder,
                    name,
                    sName,
                );
            }
        },
        [getReciterInfo],
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
        lastCompletedPlayback,
        playVerse,
        playSurah,
        playFromVerse,
        pause,
        resume,
        stop,
    };

    return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
