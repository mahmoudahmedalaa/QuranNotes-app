/**
 * TadabburContext — React Context for the entire Tadabbur feature.
 * 
 * v2 — Intent-based architecture:
 *  - Replaced track-based sessions with AI-driven intent-based verse selection
 *  - AI selects verses dynamically based on user's spiritual intent
 *  - Observable audio state for visible playback controls
 *  - LOADING phase while AI selects verses
 *  - Backward compat: still exposes `tracks` and `activeTrack` for legacy consumers
 *
 * Manages session state, reflections, stats, weekly gating, and onboarding.
 */
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { usePro } from '../../auth/infrastructure/ProContext';
import { useStreaks } from '../../auth/infrastructure/StreakContext';
import { useMood } from '../../mood/infrastructure/MoodContext';
import { MoodType, MOOD_TO_INTENT } from '../../../core/domain/entities/Mood';
import TadabburRepository from '../data/TadabburRepository';
import { AlQuranCloudAPI } from '../../../core/api/AlQuranCloudAPI';
import {
    Reflection,
    TadabburSession,
    ReflectionStats,
    TadabburTrack,
    TadabburPassage,
    ReflectionPrompt,
    ReflectionIntent,
    VerseSelection,
    SessionState,
    DEFAULT_INTENTS,
} from '../domain/entities/Reflection';
import {
    sessionReducer,
    INITIAL_STATE,
    SessionAction,
    getSessionDuration,
} from './TadabburSessionEngine';

// AI services
import {
    selectVersesForIntent,
    generateReflectionPrompts,
    suggestIntents,
} from '../domain/TadabburAIService';

// Audio state
import {
    subscribeToAudioState,
    TadabburAudioState,
    getAudioState,
} from './TadabburAudioService';

// Legacy track imports — kept for backward compat during migration
import foundationsTrack from '../data/tracks/foundations.json';
import gratitudeTrack from '../data/tracks/gratitude.json';
import patienceTrack from '../data/tracks/patience.json';
import aweTrack from '../data/tracks/awe.json';

const MAX_FREE_SESSIONS_PER_WEEK = 3;
const quranApi = new AlQuranCloudAPI();

// ─── Context shape ──────────────────────────────────────────────────────────

interface TadabburContextType {
    // Session state machine
    session: SessionState;
    dispatch: (action: SessionAction) => void;

    // Current passage & prompt
    currentPassage: TadabburPassage | null;
    currentPrompt: ReflectionPrompt | null;
    setCurrentPrompt: (p: ReflectionPrompt | null) => void;

    // Intent-based session (NEW)
    availableIntents: ReflectionIntent[];
    aiSuggestedIntents: ReflectionIntent[];
    startIntentSession: (intent: ReflectionIntent) => Promise<void>;
    startMoodSession: (mood: MoodType) => Promise<void>;
    currentMoodType: MoodType | null;
    isLoadingVerses: boolean;
    aiError: string | null;

    // Audio state (NEW)
    audioState: TadabburAudioState;

    // Legacy track data (kept for backward compat)
    tracks: TadabburTrack[];
    activeTrack: TadabburTrack | null;

    // Reflections & stats
    reflections: Reflection[];
    stats: ReflectionStats;
    refreshReflections: () => Promise<void>;

    // Gating
    weeklySessionCount: number;
    canStartSession: boolean;
    remainingFreeSessions: number;

    // Onboarding
    hasSeenOnboarding: boolean;
    dismissOnboarding: () => void;

    // Enriched passages (with fetched Arabic text + translations)
    enrichedPassages: TadabburPassage[];
    versesLoading: boolean;

    // AI prompts
    aiPromptsLoading: boolean;

    // Legacy actions (kept for backward compat)
    startSession: (trackId: string, intention?: string) => void;
    completeSession: (mood?: string) => Promise<void>;
    deleteReflection: (id: string) => Promise<void>;

    loading: boolean;
}

const defaultStats: ReflectionStats = {
    userId: '',
    totalSessions: 0,
    totalReflections: 0,
    totalMinutes: 0,
    currentStreak: 0,
    longestStreak: 0,
    surahsCovered: [],
    lastSessionDate: '',
};

const TadabburContext = createContext<TadabburContextType>({
    session: INITIAL_STATE,
    dispatch: () => { },
    currentPassage: null,
    currentPrompt: null,
    setCurrentPrompt: () => { },
    availableIntents: [],
    aiSuggestedIntents: [],
    startIntentSession: async () => { },
    startMoodSession: async () => { },
    currentMoodType: null,
    isLoadingVerses: false,
    aiError: null,
    audioState: getAudioState(),
    tracks: [],
    activeTrack: null,
    reflections: [],
    stats: defaultStats,
    refreshReflections: async () => { },
    weeklySessionCount: 0,
    canStartSession: true,
    remainingFreeSessions: MAX_FREE_SESSIONS_PER_WEEK,
    hasSeenOnboarding: false,
    dismissOnboarding: () => { },
    enrichedPassages: [],
    versesLoading: false,
    aiPromptsLoading: false,
    startSession: () => { },
    completeSession: async (_mood?: string) => { },
    deleteReflection: async () => { },
    loading: true,
});

export const useTadabbur = () => useContext(TadabburContext);

// ─── Helper ─────────────────────────────────────────────────────────────────

function todayKey(): string {
    return new Date().toISOString().split('T')[0];
}

function makeIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Provider ───────────────────────────────────────────────────────────────

// ── Tadabbur mood → MoodType mapping ──────────────────────────────────────────
const TADABBUR_MOOD_MAP: Record<string, MoodType> = {
    peaceful: 'calm',
    grateful: 'hopeful',
    reflective: 'inspired',
};

export const TadabburProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { isPro } = usePro();
    const { recordActivity } = useStreaks();
    const { recordMoodEntry } = useMood();
    const uid = user?.id || 'anonymous';
    const prevUidRef = useRef<string | null>(null);

    // State machine
    const [session, dispatch] = useReducer(sessionReducer, INITIAL_STATE);
    const [currentPrompt, setCurrentPrompt] = useState<ReflectionPrompt | null>(null);

    // Intent-based state (NEW)
    const [isLoadingVerses, setIsLoadingVerses] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSuggestedIntents, setAiSuggestedIntents] = useState<ReflectionIntent[]>([]);

    // Audio state (NEW)
    const [audioState, setAudioState] = useState<TadabburAudioState>(getAudioState());

    // Enriched passages with real Arabic text + translations
    const [enrichedPassages, setEnrichedPassages] = useState<TadabburPassage[]>([]);
    const [versesLoading, setVersesLoading] = useState(false);
    const [aiPromptsLoading, setAiPromptsLoading] = useState(false);

    // Persisted data
    const [reflections, setReflections] = useState<Reflection[]>([]);
    const [stats, setStats] = useState<ReflectionStats>({ ...defaultStats, userId: uid });
    const [weeklySessionCount, setWeeklySessionCount] = useState(0);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
    const [loading, setLoading] = useState(true);

    // Default intents with generated IDs
    const availableIntents = useMemo<ReflectionIntent[]>(() =>
        DEFAULT_INTENTS.map((d, i) => ({ ...d, id: `default_intent_${i}` })),
        [],
    );

    // Legacy tracks (backward compat)
    const tracks = useMemo<TadabburTrack[]>(() => [
        foundationsTrack as unknown as TadabburTrack,
        gratitudeTrack as unknown as TadabburTrack,
        patienceTrack as unknown as TadabburTrack,
        aweTrack as unknown as TadabburTrack,
    ], []);

    // ── Subscribe to audio state ────────────────────────────────────────────

    useEffect(() => {
        const unsubscribe = subscribeToAudioState(setAudioState);
        return unsubscribe;
    }, []);

    // ── Fetch AI-suggested intents (Pro only) ───────────────────────────────

    useEffect(() => {
        if (!isPro) {
            setAiSuggestedIntents([]);
            return;
        }

        let cancelled = false;
        const fetchSuggestions = async () => {
            try {
                const suggestions = await suggestIntents();
                if (!cancelled && suggestions.length > 0) {
                    setAiSuggestedIntents(suggestions);
                }
            } catch {
                // Silently fail — suggestions are optional
            }
        };

        fetchSuggestions();
        return () => { cancelled = true; };
    }, [isPro, uid]);

    // ── Load persisted data on user change ──────────────────────────────────

    useEffect(() => {
        if (prevUidRef.current !== null && prevUidRef.current !== uid) {
            // User switched — reset in-memory state
            setReflections([]);
            setStats({ ...defaultStats, userId: uid });
            setWeeklySessionCount(0);
            setHasSeenOnboarding(false);
            dispatch({ type: 'ABORT' });
        }
        prevUidRef.current = uid;

        (async () => {
            setLoading(true);
            try {
                const [refs, st, wc, onb] = await Promise.all([
                    TadabburRepository.getReflections(uid),
                    TadabburRepository.getStats(uid),
                    TadabburRepository.getWeeklySessionCount(uid),
                    TadabburRepository.hasSeenOnboarding(uid),
                ]);
                setReflections(refs);
                setStats(st);
                setWeeklySessionCount(wc);
                setHasSeenOnboarding(onb);
            } catch (e) {
                if (__DEV__) console.error('[TadabburContext] Error loading state:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [uid]);

    // ── Derived state ───────────────────────────────────────────────────────

    const canStartSession = useMemo(
        () => isPro || weeklySessionCount < MAX_FREE_SESSIONS_PER_WEEK,
        [isPro, weeklySessionCount],
    );

    const remainingFreeSessions = useMemo(
        () => Math.max(0, MAX_FREE_SESSIONS_PER_WEEK - weeklySessionCount),
        [weeklySessionCount],
    );

    // Legacy backward compat
    const activeTrack = useMemo(() => {
        if (session.trackId) return tracks.find((t) => t.id === session.trackId) || null;
        return null;
    }, [session.trackId, tracks]);

    const currentPassage = useMemo<TadabburPassage | null>(() => {
        // Prefer enriched passages (with fetched Arabic text)
        if (enrichedPassages.length > 0) {
            return enrichedPassages[session.currentVerseIndex] || null;
        }
        if (!activeTrack) return null;
        return activeTrack.passages[session.currentVerseIndex] || null;
    }, [enrichedPassages, activeTrack, session.currentVerseIndex]);

    // ── NEW: Intent-based session start ─────────────────────────────────────

    const startIntentSession = useCallback(
        async (intent: ReflectionIntent, moodType?: MoodType) => {
            setAiError(null);
            setIsLoadingVerses(true);
            setCurrentPrompt(null);
            setEnrichedPassages([]);

            try {
                // Step 1: AI selects verses for this intent
                const verseSelections = await selectVersesForIntent(intent, 3);

                if (verseSelections.length === 0) {
                    setAiError('Could not find suitable verses. Please try again.');
                    setIsLoadingVerses(false);
                    return;
                }

                // Step 2: Build passages from AI selections
                const passages: TadabburPassage[] = verseSelections.map((vs) => ({
                    surahNumber: vs.surahNumber,
                    startVerse: vs.startVerse,
                    endVerse: vs.endVerse,
                    prompts: [],
                    selectionReason: vs.reason,
                }));

                // Step 3: Start the session engine
                dispatch({
                    type: 'START',
                    passages,
                    intent,
                    verseSelections,
                    moodType,
                });

                // Step 4: Fetch enriched verse data (Arabic text + translations)
                setVersesLoading(true);
                try {
                    const surahNumbers = [...new Set(passages.map((p) => p.surahNumber))];
                    const surahMap = new Map<number, Awaited<ReturnType<typeof quranApi.getSurah>>>();

                    await Promise.all(
                        surahNumbers.map(async (num) => {
                            const surah = await quranApi.getSurah(num);
                            surahMap.set(num, surah);
                        }),
                    );

                    const enriched: TadabburPassage[] = passages.map((passage) => {
                        const surah = surahMap.get(passage.surahNumber);
                        if (!surah) return passage;

                        const versesInRange = surah.verses.filter(
                            (v) => v.number >= passage.startVerse && v.number <= passage.endVerse,
                        );

                        return {
                            ...passage,
                            arabicText: versesInRange.map((v) => v.text).join(' '),
                            translationText: versesInRange.map((v) => v.translation).join(' '),
                            surahName: surah.englishName,
                            surahNameArabic: surah.name,
                        };
                    });

                    setEnrichedPassages(enriched);

                    // Step 5: For Pro users, generate AI prompts for each verse
                    if (isPro) {
                        setAiPromptsLoading(true);
                        try {
                            const passagesWithPrompts = await Promise.all(
                                enriched.map(async (passage) => {
                                    try {
                                        const prompts = await generateReflectionPrompts(
                                            passage.surahNumber,
                                            passage.startVerse,
                                            passage.endVerse,
                                            passage.surahName || `Surah ${passage.surahNumber}`,
                                            intent,
                                            passage.arabicText,
                                            passage.translationText,
                                        );
                                        return { ...passage, prompts };
                                    } catch {
                                        return passage;
                                    }
                                }),
                            );
                            setEnrichedPassages(passagesWithPrompts);
                        } catch {
                            // AI prompt failure is non-critical
                        } finally {
                            setAiPromptsLoading(false);
                        }
                    }
                } catch (e) {
                    if (__DEV__) console.error('[TadabburContext] Verse enrichment error:', e);
                    // Session still works with unenriched passages
                    setEnrichedPassages(passages);
                } finally {
                    setVersesLoading(false);
                }
            } catch (e: any) {
                if (__DEV__) console.error('[TadabburContext] Intent session error:', e);
                setAiError(e?.message || 'Failed to start session. Please try again.');
            } finally {
                setIsLoadingVerses(false);
            }
        },
        [isPro],
    );

    // ── NEW: Mood-based session start (from dashboard mood carousel) ──────────

    const [currentMoodType, setCurrentMoodType] = useState<MoodType | null>(null);

    const startMoodSession = useCallback(
        async (mood: MoodType) => {
            const mapping = MOOD_TO_INTENT[mood];
            if (!mapping) {
                if (__DEV__) console.warn('[TadabburContext] No mapping for mood:', mood);
                return;
            }

            setCurrentMoodType(mood);

            // Build a ReflectionIntent from the mood mapping
            const moodIntent: ReflectionIntent = {
                id: `mood_${mood}_${Date.now()}`,
                label: mapping.label,
                icon: 'heart-outline',
                category: mapping.category,
                isCustom: false,
                isAiSuggested: false,
            };

            // Delegate to startIntentSession — it handles loading, AI, enrichment,
            // and dispatches START with moodType in one atomic call.
            await startIntentSession(moodIntent, mood);
        },
        [startIntentSession],
    );

    // ── Legacy: Track-based session start (backward compat) ─────────────────

    const startSession = useCallback(
        (trackId: string, _intention?: string) => {
            const track = tracks.find((t) => t.id === trackId);
            if (!track) return;
            dispatch({
                type: 'START',
                passages: track.passages,
            });
            setCurrentPrompt(null);

            // Fetch real Arabic text + translations
            setVersesLoading(true);
            const fetchVerses = async () => {
                try {
                    const surahNumbers = [...new Set(track.passages.map((p) => p.surahNumber))];
                    const surahMap = new Map<number, Awaited<ReturnType<typeof quranApi.getSurah>>>();

                    await Promise.all(
                        surahNumbers.map(async (num) => {
                            const surah = await quranApi.getSurah(num);
                            surahMap.set(num, surah);
                        }),
                    );

                    const enriched: TadabburPassage[] = track.passages.map((passage) => {
                        const surah = surahMap.get(passage.surahNumber);
                        if (!surah) return passage;

                        const versesInRange = surah.verses.filter(
                            (v) => v.number >= passage.startVerse && v.number <= passage.endVerse,
                        );

                        return {
                            ...passage,
                            arabicText: versesInRange.map((v) => v.text).join(' '),
                            translationText: versesInRange.map((v) => v.translation).join(' '),
                            surahName: surah.englishName,
                            surahNameArabic: surah.name,
                        };
                    });

                    setEnrichedPassages(enriched);
                } catch (e) {
                    if (__DEV__) console.error('[TadabburContext] Failed to fetch verses:', e);
                    setEnrichedPassages(track.passages);
                } finally {
                    setVersesLoading(false);
                }
            };

            fetchVerses();
        },
        [tracks],
    );

    const completeSession = useCallback(async (mood?: string) => {
        const durationSeconds = getSessionDuration(session);
        const now = new Date().toISOString();

        // Create session record
        const sessionRecord: TadabburSession = {
            id: `ts_${Date.now()}`,
            userId: uid,
            date: todayKey(),
            durationSeconds,
            versesReflectedOn: session.reflections.length,
            completedFully: session.currentVerseIndex >= session.totalVerses - 1,
            createdAt: now,
            intent: session.intent!,
            verseSelections: session.verseSelections || [],
            mood,
            moodType: session.moodType || currentMoodType || undefined,
        };

        try {
            await TadabburRepository.saveSession(uid, sessionRecord);
            if (session.reflections.length > 0) {
                await TadabburRepository.saveReflections(uid, session.reflections);
            }

            // Update stats
            const newSurahs = new Set(stats.surahsCovered);
            session.reflections.forEach((r) => newSurahs.add(r.surahNumber));
            const isNewDay = stats.lastSessionDate !== todayKey();

            const updatedStats: ReflectionStats = {
                userId: uid,
                totalSessions: stats.totalSessions + 1,
                totalReflections: stats.totalReflections + session.reflections.length,
                totalMinutes: stats.totalMinutes + Math.round(durationSeconds / 60),
                currentStreak: isNewDay ? stats.currentStreak + 1 : stats.currentStreak,
                longestStreak: isNewDay
                    ? Math.max(stats.longestStreak, stats.currentStreak + 1)
                    : stats.longestStreak,
                surahsCovered: Array.from(newSurahs),
                lastSessionDate: todayKey(),
            };
            await TadabburRepository.saveStats(uid, updatedStats);
            setStats(updatedStats);

            const newWeekly = await TadabburRepository.incrementWeeklyCount(uid);
            setWeeklySessionCount(newWeekly);

            const freshReflections = await TadabburRepository.getReflections(uid);
            setReflections(freshReflections);

            await recordActivity();

            // Bridge mood to Mood Insight Widget
            if (mood && TADABBUR_MOOD_MAP[mood]) {
                await recordMoodEntry(TADABBUR_MOOD_MAP[mood]);
            }
        } catch (e) {
            if (__DEV__) console.error('[TadabburContext] Error completing session:', e);
        }

        dispatch({ type: 'FINISH' });
        setCurrentPrompt(null);
        setEnrichedPassages([]);
        setCurrentMoodType(null);
    }, [session, uid, stats, recordActivity, recordMoodEntry]);

    const refreshReflections = useCallback(async () => {
        try {
            const refs = await TadabburRepository.getReflections(uid);
            setReflections(refs);
        } catch { /* silent */ }
    }, [uid]);

    const deleteReflection = useCallback(async (id: string) => {
        try {
            await TadabburRepository.deleteReflection(uid, id);
            setReflections((prev) => prev.filter((r) => r.id !== id));
        } catch { /* silent */ }
    }, [uid]);

    const dismissOnboarding = useCallback(() => {
        setHasSeenOnboarding(true);
        TadabburRepository.markOnboardingSeen(uid).catch(() => { });
    }, [uid]);

    // ── Value ───────────────────────────────────────────────────────────────

    const value = useMemo<TadabburContextType>(
        () => ({
            session,
            dispatch,
            currentPassage,
            currentPrompt,
            setCurrentPrompt,
            availableIntents,
            aiSuggestedIntents,
            startIntentSession,
            startMoodSession,
            currentMoodType,
            isLoadingVerses,
            aiError,
            audioState,
            tracks,
            activeTrack,
            enrichedPassages,
            versesLoading,
            aiPromptsLoading,
            reflections,
            stats,
            refreshReflections,
            weeklySessionCount,
            canStartSession,
            remainingFreeSessions,
            hasSeenOnboarding,
            dismissOnboarding,
            startSession,
            completeSession,
            deleteReflection,
            loading,
        }),
        [
            session,
            currentPassage,
            currentPrompt,
            availableIntents,
            aiSuggestedIntents,
            startIntentSession,
            startMoodSession,
            currentMoodType,
            isLoadingVerses,
            aiError,
            audioState,
            tracks,
            activeTrack,
            enrichedPassages,
            versesLoading,
            aiPromptsLoading,
            reflections,
            stats,
            refreshReflections,
            weeklySessionCount,
            canStartSession,
            remainingFreeSessions,
            hasSeenOnboarding,
            dismissOnboarding,
            startSession,
            completeSession,
            deleteReflection,
            loading,
        ],
    );

    return (
        <TadabburContext.Provider value={value}>
            {children}
        </TadabburContext.Provider>
    );
};
