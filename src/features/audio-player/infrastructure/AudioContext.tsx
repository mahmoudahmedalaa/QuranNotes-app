/**
 * ⚠️  LOCKED FILE — See docs/AUDIO_STABILITY.md ⚠️
 * Do NOT modify without explicit user approval.
 *
 * AudioContext — Global audio state provider
 * Lifts audio playback state from local hook to app-wide context.
 * Audio continues playing across screen navigation.
 *
 * Supports TWO playback modes:
 * 1. Full-surah (gapless): Uses Quran.com API for single MP3 + verse timestamps
 * 2. Per-verse (fallback): Uses everyayah.com individual MP3s
 *
 * Uses react-native-track-player for native audio queue,
 * lock screen controls, and gapless playback.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AudioPlayerService, PlaybackStatus } from './AudioPlayerService';
import { getChapterAudio } from './QuranAudioApi';
import { Surah, Verse } from '../../../core/domain/entities/Quran';
import { useSettings } from '../../settings/infrastructure/SettingsContext';
import { getReciterById, hasFullSurahAudio } from '../domain/Reciter';
import { ReadingHistoryService } from '../../quran-reading/infrastructure/ReadingHistoryService';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';
import { useAuth } from '../../auth/infrastructure/AuthContext';

// Singleton player instance (shared across the app)
const player = new AudioPlayerService();

const LAST_SESSION_KEY = 'audio_last_session';

/** Persisted audio session — survives stop/app restart */
export interface AudioSession {
    surahNum: number;
    surahName: string;
    verse: number;
    timestamp: number;
    completed: boolean; // true if queue finished naturally
}

/** Info about a completed playback session — used for batch Khatma tracking */
export interface CompletedPlayback {
    surah: number;
    verses: Verse[];
    timestamp: number;
}

interface AudioContextType {
    playingVerse: { surah: number; verse: number } | null;
    isPlaying: boolean;
    isLoading: boolean;
    currentSurahNum: number | null;
    currentSurahName: string | null;
    playlist: Verse[];
    /** Populated when playback queue ends — Surah screen uses this to batch-record Khatma pages */
    lastCompletedPlayback: CompletedPlayback | null;
    /** Persisted session — survives stop, lives until user explicitly dismisses */
    lastSession: AudioSession | null;
    playVerse: (surahNum: number, verseNum: number, surah?: Surah) => Promise<void>;
    playSurah: (surah: Surah) => Promise<void>;
    playFromVerse: (surah: Surah, verseNum: number) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    /** Clear the persisted session — user explicitly dismisses the mini player */
    dismissSession: () => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudio = (): AudioContextType => {
    const ctx = useContext(AudioContext);
    if (!ctx) throw new Error('useAudio must be used within AudioProvider');
    return ctx;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings } = useSettings();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [playingVerse, setPlayingVerse] = useState<{ surah: number; verse: number } | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, _setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    // Wrapper that keeps ref in sync with state, preventing stale closures in event listeners
    const setIsLoading = useCallback((val: boolean) => {
        isLoadingRef.current = val;
        _setIsLoading(val);
    }, []);
    const [currentSurahName, setCurrentSurahName] = useState<string | null>(null);
    const [lastCompletedPlayback, setLastCompletedPlayback] = useState<CompletedPlayback | null>(null);
    const [lastSession, setLastSession] = useState<AudioSession | null>(null);

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
    // Generation counter to suppress verse updates during reciter switch (prevents verse 1 flash).
    // Each reciter switch increments the counter; event listener only processes
    // verse updates when its captured generation matches the current one. No timeouts needed.
    const switchGenerationRef = useRef(0);

    // Get reciter info
    const getReciterInfo = useCallback(() => {
        const reciter = getReciterById(settings.reciterId);
        return { cdnFolder: reciter.cdnFolder, name: reciter.name, reciter };
    }, [settings.reciterId]);

    // ── Helper: Start full-surah gapless playback ──
    const startFullSurahPlayback = useCallback(async (
        surahNum: number,
        surahName: string,
        quranComId: number,
        reciterName: string,
        startVerseNum?: number,
    ): Promise<boolean> => {
        try {
            console.log(`[AUDIO-DEBUG] Fetching chapter audio: reciterId=${quranComId}, surah=${surahNum}`);
            const chapterAudio = await getChapterAudio(quranComId, surahNum);
            if (!chapterAudio) {
                console.log('[AUDIO-DEBUG] getChapterAudio returned NULL — API failed');
                return false;
            }
            console.log(`[AUDIO-DEBUG] Got audio: url=${chapterAudio.audioUrl.substring(0, 60)}..., timestamps=${chapterAudio.timestamps.length}`);

            const startVerseKey = startVerseNum ? `${surahNum}:${startVerseNum}` : undefined;
            await player.loadFullSurah(
                surahNum,
                chapterAudio.audioUrl,
                chapterAudio.timestamps,
                reciterName,
                surahName,
                startVerseKey,
            );
            console.log('[AUDIO-DEBUG] loadFullSurah completed successfully ✅');
            return true;
        } catch (e) {
            console.warn('[AUDIO-DEBUG] Full-surah playback EXCEPTION:', e);
            return false;
        }
    }, []);

    // Initialize player + restore last session on mount
    useEffect(() => {
        player.setup().catch(e => console.warn('[AudioContext] Setup failed:', e));
        // Restore persisted session for cold-start resume
        UserScopedStorage.getItem(LAST_SESSION_KEY, userId).then(raw => {
            if (raw) {
                try {
                    setLastSession(JSON.parse(raw));
                } catch { /* corrupt — ignore */ }
            }
        }).catch(() => { /* silent */ });
    }, [userId]);

    // Live reciter switch — reload current playback with new reciter
    // FIX: Removed isPlaying gate — now works even when paused.
    // FIX: Uses generation counter instead of fragile boolean+timeout guard.
    useEffect(() => {
        if (prevReciterRef.current !== settings.reciterId && playingVerse) {
            const wasPlaying = isPlaying;
            const pl = playlistRef.current;
            const surahNum = currentSurahNumRef.current;
            const surahName = currentSurahNameRef.current;
            if (pl.length > 0 && surahNum) {
                // Increment generation to suppress verse updates during the switch
                switchGenerationRef.current += 1;
                const switchGen = switchGenerationRef.current;

                setIsLoading(true);
                const { cdnFolder, name, reciter } = getReciterInfo();

                const finishSwitch = async (loadPromise: Promise<boolean | void>) => {
                    try {
                        await loadPromise;
                    } catch (e) {
                        if (__DEV__) console.warn('[AudioContext] reciter switch failed:', e);
                    } finally {
                        // Only clear if no newer switch happened
                        if (switchGenerationRef.current === switchGen) {
                            setIsLoading(false);
                            // If user was paused, pause the new reciter too
                            if (!wasPlaying) {
                                try { await player.pause(); } catch { /* best effort */ }
                            }
                        }
                    }
                };

                if (hasFullSurahAudio(reciter) && reciter.quranComId) {
                    finishSwitch(
                        startFullSurahPlayback(
                            surahNum,
                            surahName || 'Quran',
                            reciter.quranComId,
                            name,
                            playingVerse.verse,
                        ).then(success => {
                            if (!success) {
                                const currentIndex = pl.findIndex(v => v.number === playingVerse.verse);
                                return player.loadPlaylist(
                                    surahNum, pl,
                                    currentIndex >= 0 ? currentIndex : 0,
                                    cdnFolder, name, surahName || 'Quran',
                                );
                            }
                        }),
                    );
                } else {
                    const currentIndex = pl.findIndex(v => v.number === playingVerse.verse);
                    finishSwitch(
                        player.loadPlaylist(
                            surahNum, pl,
                            currentIndex >= 0 ? currentIndex : 0,
                            cdnFolder, name, surahName || 'Quran',
                        ),
                    );
                }
            }
        }
        prevReciterRef.current = settings.reciterId;
    }, [settings.reciterId, playingVerse, isPlaying, getReciterInfo, startFullSurahPlayback]);

    // ── Listen to player events ──
    useEffect(() => {
        // Capture the generation at listener setup time (always 0 on mount).
        // The listener checks against the CURRENT ref value at event time.
        const unsubscribe = player.addListener(async (status: PlaybackStatus) => {
            setIsPlaying(status.isPlaying);

            // Clear loading state when playback actually starts
            if (status.isPlaying) {
                setIsLoading(false);
            }

            // Skip verse detection updates while a reciter switch is in-flight.
            // Uses generation counter: if switchGenerationRef was incremented
            // since event subscription, a switch is in progress. We check if
            // the generation changed DURING this event handling cycle.
            // NOTE: Only skip verse updates — do NOT block the entire listener,
            // or didJustFinish and isPlaying updates will be suppressed.
            const isSwitching = switchGenerationRef.current > 0 && isLoadingRef.current;
            if (!isSwitching) {
                // Full-surah mode: verse detection via timestamp polling
                if (status.currentVerseKey) {
                    const [surahStr, verseStr] = status.currentVerseKey.split(':');
                    const surahNum = parseInt(surahStr);
                    const verseNum = parseInt(verseStr);
                    if (!isNaN(surahNum) && !isNaN(verseNum)) {
                        setPlayingVerse({ surah: surahNum, verse: verseNum });
                        // Update lock screen now-playing metadata
                        const pl = playlistRef.current;
                        const sName = currentSurahNameRef.current;
                        const reciter = getReciterById(prevReciterRef.current);
                        player.updateNowPlayingVerse(
                            sName || 'Quran',
                            verseNum,
                            pl.length,
                            reciter.name,
                        );
                    }
                }

                // Per-verse mode: track changed in the queue — update playingVerse from playlist
                // Guard: only applies when NOT in full-surah mode (prevents verse 1 flash on reciter switch)
                if (status.activeTrackIndex !== undefined && !player.getIsFullSurahMode()) {
                    const pl = playlistRef.current;
                    const surahNum = currentSurahNumRef.current;
                    if (pl.length > 0 && surahNum && status.activeTrackIndex < pl.length) {
                        const verse = pl[status.activeTrackIndex];
                        setPlayingVerse({ surah: surahNum, verse: verse.number });
                    }
                }
            }

            /**
             * ════════════════════════════════════════════════════════════════
             * BULLETPROOF GUARD: Queue completion — clear playback state
             * ════════════════════════════════════════════════════════════════
             *
             * ⚠️  DO NOT REMOVE THIS GUARD  ⚠️
             *
             * This is the SECOND line of defense against premature state clearing.
             * The FIRST line is in AudioPlayerService.ts (subscribeToEvents).
             *
             * Before clearing all playback state, we independently verify with
             * the native RNTP player that playback is ACTUALLY finished:
             *   1. Check activeTrackIndex is at or past the last track
             *   2. Check playback state is NOT still Playing
             *
             * This prevents future regressions where AudioPlayerService might
             * accidentally emit didJustFinish mid-queue due to:
             *   - Native rebuild timing changes (March 2026 regression)
             *   - RNTP version upgrades
             *   - Code modifications by future developers or AI
             *
             * If the guard rejects the didJustFinish, it logs a warning
             * and resumes playback instead of clearing state.
             * ════════════════════════════════════════════════════════════════
             */
            if (status.didJustFinish) {
                // ── SAFETY CHECK: independently verify with the native player ──
                try {
                    const TrackPlayer = require('react-native-track-player').default;
                    const queue = await TrackPlayer.getQueue();
                    const activeIdx = await TrackPlayer.getActiveTrackIndex();
                    const tpState = await TrackPlayer.getPlaybackState();
                    const { State: TPState } = require('react-native-track-player');

                    const isStillPlaying = tpState?.state === TPState.Playing;
                    const isAtEnd = activeIdx === undefined ||
                        activeIdx === null ||
                        queue.length === 0 ||
                        activeIdx >= queue.length - 1;

                    if (!isAtEnd || isStillPlaying) {
                        // ⛔ BLOCKED: native player says queue is NOT exhausted.
                        // This is a spurious didJustFinish — DO NOT clear state.
                        if (__DEV__) {
                            console.warn(
                                `[AudioContext] BLOCKED spurious didJustFinish! ` +
                                `activeIdx=${activeIdx}, queueLen=${queue.length}, ` +
                                `state=${tpState?.state}. Resuming playback.`
                            );
                        }
                        // Try to resume playback since we're mid-queue
                        try { await TrackPlayer.play(); } catch { /* best effort */ }
                        return; // ← EXIT: do NOT clear state
                    }
                } catch {
                    // If we can't verify, fall through to normal handling.
                    // This is conservative: better to clear state than leave
                    // a zombie session.
                }

                // ── Verified: playback genuinely finished ──
                const finishedSurah = currentSurahNumRef.current;
                const finishedPlaylist = playlistRef.current;
                const finishedName = currentSurahNameRef.current;
                if (finishedSurah && finishedPlaylist.length > 0) {
                    setLastCompletedPlayback({
                        surah: finishedSurah,
                        verses: [...finishedPlaylist],
                        timestamp: Date.now(),
                    });
                    // Save session so mini player persists in "completed" state
                    const session: AudioSession = {
                        surahNum: finishedSurah,
                        surahName: finishedName || `Surah ${finishedSurah}`,
                        verse: finishedPlaylist[finishedPlaylist.length - 1].number,
                        timestamp: Date.now(),
                        completed: true,
                    };
                    setLastSession(session);
                    UserScopedStorage.setItem(LAST_SESSION_KEY, userId, JSON.stringify(session)).catch(() => { });
                    // Record in reading history
                    ReadingHistoryService.addEntry({
                        surah: finishedSurah,
                        surahName: finishedName || `Surah ${finishedSurah}`,
                        verse: finishedPlaylist[finishedPlaylist.length - 1].number,
                        timestamp: Date.now(),
                        source: 'audio',
                    }, userId).catch(() => { });
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
    }, [userId]);

    // Play a specific verse (with optional surah context for queue)
    const playVerse = useCallback(
        async (surahNum: number, verseNum: number, surah?: Surah) => {
            try {
                const { cdnFolder, name, reciter } = getReciterInfo();

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

                        // Try full-surah gapless mode first
                        if (hasFullSurahAudio(reciter) && reciter.quranComId) {
                            const success = await startFullSurahPlayback(
                                surah.number,
                                sName,
                                reciter.quranComId,
                                name,
                                verseNum,
                            );
                            if (success) return;
                        }

                        // Fallback: per-verse mode
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
                    // If in full-surah mode, seek within the track
                    if (player.getIsFullSurahMode()) {
                        const verseKey = `${surahNum}:${verseNum}`;
                        setPlayingVerse({ surah: surahNum, verse: verseNum });
                        await player.seekToVerse(verseKey);
                        return;
                    }
                    // Per-verse mode: skip to track
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
                setIsLoading(true);
                await player.playVerse(surahNum, verseNum, cdnFolder, name);
            } catch (e) {
                if (__DEV__) console.warn('[AudioContext] playVerse failed:', e);
                // FIX: Roll back optimistic state on failure
                setPlayingVerse(null);
                setIsLoading(false);
                setIsPlaying(false);
            }
        },
        [getReciterInfo, startFullSurahPlayback, setIsLoading],
    );

    // Play entire surah from beginning
    const playSurah = useCallback(
        async (surah: Surah) => {
            try {
                setPlaylist(surah.verses);
                playlistRef.current = surah.verses;
                setCurrentSurahNum(surah.number);
                currentSurahNumRef.current = surah.number;
                const sName = surah.englishName || surah.name;
                setCurrentSurahName(sName);
                currentSurahNameRef.current = sName;

                if (surah.verses.length > 0) {
                    setPlayingVerse({ surah: surah.number, verse: surah.verses[0].number });
                    setIsLoading(true);
                    const { cdnFolder, name, reciter } = getReciterInfo();

                    console.log(`[AUDIO-DEBUG] playSurah: reciter=${reciter.id}, quranComId=${reciter.quranComId}, hasFullSurah=${hasFullSurahAudio(reciter)}`);

                    // Try full-surah gapless mode first
                    if (hasFullSurahAudio(reciter) && reciter.quranComId) {
                        console.log('[AUDIO-DEBUG] Attempting full-surah gapless mode...');
                        const success = await startFullSurahPlayback(
                            surah.number,
                            sName,
                            reciter.quranComId,
                            name,
                        );
                        console.log(`[AUDIO-DEBUG] Full-surah result: ${success ? 'SUCCESS ✅' : 'FAILED ❌ — falling back to per-verse'}`);
                        if (success) return;
                    } else {
                        console.log('[AUDIO-DEBUG] No quranComId — using per-verse mode directly');
                    }

                    // Fallback: per-verse mode
                    console.log('[AUDIO-DEBUG] Loading per-verse playlist...');
                    await player.loadPlaylist(
                        surah.number,
                        surah.verses,
                        0,
                        cdnFolder,
                        name,
                        sName,
                    );
                }
            } catch (e) {
                console.warn('[AudioContext] playSurah failed:', e);
                // FIX: Roll back optimistic state on failure
                setPlayingVerse(null);
                setIsLoading(false);
                setIsPlaying(false);
            }
        },
        [getReciterInfo, startFullSurahPlayback, setIsLoading],
    );

    // Play from a specific verse within a surah
    // FIX: Sets isLoading immediately, rolls back state on failure.
    const playFromVerse = useCallback(
        async (surah: Surah, verseNum: number) => {
            try {
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
                    setIsLoading(true);
                    const { cdnFolder, name, reciter } = getReciterInfo();

                    // Try full-surah gapless mode first
                    if (hasFullSurahAudio(reciter) && reciter.quranComId) {
                        const success = await startFullSurahPlayback(
                            surah.number,
                            sName,
                            reciter.quranComId,
                            name,
                            verseNum,
                        );
                        if (success) {
                            // isLoading will be cleared by the event listener when Playing starts
                            return;
                        }
                    }

                    // Fallback: per-verse mode
                    await player.loadPlaylist(
                        surah.number,
                        surah.verses,
                        startIndex,
                        cdnFolder,
                        name,
                        sName,
                    );
                    // isLoading will be cleared by the event listener when Playing starts
                }
            } catch (e) {
                if (__DEV__) console.warn('[AudioContext] playFromVerse failed:', e);
                // FIX: Roll back optimistic state on failure
                setPlayingVerse(null);
                setIsLoading(false);
                setIsPlaying(false);
            }
        },
        [getReciterInfo, startFullSurahPlayback, setIsLoading],
    );

    const pause = useCallback(async () => {
        try {
            setIsPlaying(false);
            await player.pause();
        } catch (e) {
            if (__DEV__) console.warn('[AudioContext] pause failed:', e);
        }
    }, []);

    const resume = useCallback(async () => {
        try {
            setIsPlaying(true);
            await player.resume();
        } catch (e) {
            setIsPlaying(false);
            if (__DEV__) console.warn('[AudioContext] resume failed:', e);
        }
    }, []);

    const stop = useCallback(async () => {
        try {
            // Save session before clearing playback state
            const sNum = currentSurahNumRef.current;
            const sName = currentSurahNameRef.current;
            const pv = playingVerse;
            if (sNum && pv) {
                const session: AudioSession = {
                    surahNum: sNum,
                    surahName: sName || `Surah ${sNum}`,
                    verse: pv.verse,
                    timestamp: Date.now(),
                    completed: false,
                };
                setLastSession(session);
                UserScopedStorage.setItem(LAST_SESSION_KEY, userId, JSON.stringify(session)).catch(() => { });
                // Record in reading history
                ReadingHistoryService.addEntry({
                    surah: sNum,
                    surahName: sName || `Surah ${sNum}`,
                    verse: pv.verse,
                    timestamp: Date.now(),
                    source: 'audio',
                }, userId).catch(() => { });
            }
            setIsPlaying(false);
            setPlayingVerse(null);
            await player.stop();
            setPlaylist([]);
            playlistRef.current = [];
            setCurrentSurahNum(null);
            currentSurahNumRef.current = null;
            setCurrentSurahName(null);
            currentSurahNameRef.current = null;
        } catch (e) {
            if (__DEV__) console.warn('[AudioContext] stop failed:', e);
        }
    }, [playingVerse, userId]);

    const dismissSession = useCallback(() => {
        setLastSession(null);
        UserScopedStorage.removeItem(LAST_SESSION_KEY, userId).catch(() => { });
    }, [userId]);

    // Clear lastSession when new playback starts
    useEffect(() => {
        if (playingVerse) {
            setLastSession(null);
        }
    }, [playingVerse]);

    const value: AudioContextType = {
        playingVerse,
        isPlaying,
        isLoading,
        currentSurahNum,
        currentSurahName,
        playlist,
        lastCompletedPlayback,
        lastSession,
        playVerse,
        playSurah,
        playFromVerse,
        pause,
        resume,
        stop,
        dismissSession,
    };

    return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};
