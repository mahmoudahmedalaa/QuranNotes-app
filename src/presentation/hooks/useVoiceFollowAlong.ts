import { useState, useEffect, useCallback, useRef } from 'react';
import VoiceRecognitionService, { VoiceRecognitionResult, VoiceRecognitionServiceImpl } from '../../infrastructure/voice/VoiceRecognitionService';
import { Verse } from '../../domain/entities/Quran';
import {
    FollowAlongSession,
    calculateSessionAccuracy,
    calculateSessionDuration
} from '../../domain/entities/FollowAlongSession';
import { LocalFollowAlongRepository } from '../../data/local/LocalFollowAlongRepository';
import { usePro } from '../../infrastructure/auth/ProContext';
import { MatchingService } from '../../infrastructure/voice/MatchingService';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const FREE_SESSIONS_PER_DAY = 3;

interface UseVoiceFollowAlongResult {
    isActive: boolean;
    isListening: boolean;
    transcript: string;
    matchedVerseId: number | null;
    matchConfidence: number;
    sessionsRemaining: number;
    versesRecited: number[];
    currentSessionDuration: number;
    startSession: () => Promise<void>;
    stopSession: () => Promise<FollowAlongSession | null>;
    canStartSession: boolean;
}

export function useVoiceFollowAlong(
    verses: Verse[],
    surahId?: number,
    surahName?: string,
    surahNameArabic?: string
): UseVoiceFollowAlongResult {
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [matchedVerseId, setMatchedVerseId] = useState<number | null>(null);
    const [matchConfidence, setMatchConfidence] = useState(0);
    const [sessionsUsedToday, setSessionsUsedToday] = useState(0);
    const [versesRecited, setVersesRecited] = useState<number[]>([]);
    const [currentSessionDuration, setCurrentSessionDuration] = useState(0);

    const sessionStartTime = useRef<Date | null>(null);
    const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const repository = useRef(new LocalFollowAlongRepository());

    const { isPro } = usePro();
    const router = useRouter();

    // Load sessions used today from AsyncStorage
    useEffect(() => {
        loadSessionsUsed();
    }, []);

    // Duration timer
    useEffect(() => {
        if (isActive) {
            durationInterval.current = setInterval(() => {
                setCurrentSessionDuration(d => d + 1);
            }, 1000);
        } else {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
                durationInterval.current = null;
            }
            setCurrentSessionDuration(0);
        }

        return () => {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
            }
        };
    }, [isActive]);

    const loadSessionsUsed = async () => {
        try {
            const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
            const today = new Date().toDateString();
            const key = `voice_sessions_${today}`;
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                setSessionsUsedToday(parseInt(stored, 10));
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    const incrementSessionCount = async () => {
        try {
            const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
            const today = new Date().toDateString();
            const key = `voice_sessions_${today}`;
            const newCount = sessionsUsedToday + 1;
            await AsyncStorage.setItem(key, newCount.toString());
            setSessionsUsedToday(newCount);
        } catch (error) {
            console.error('Failed to increment sessions:', error);
        }
    };

    const canStartSession = (): boolean => {
        if (isPro) return true;
        return sessionsUsedToday < FREE_SESSIONS_PER_DAY;
    };

    const handleResult = useCallback((result: VoiceRecognitionResult) => {
        setTranscript(result.transcript);

        // Find best matching verse - Optimization: Search window around last matched verse
        // If we have a match, look at next 3 verses. If not, look at first 3.
        let candidates = verses;
        if (matchedVerseId) {
            const currentIndex = verses.findIndex(v => v.number === matchedVerseId);
            if (currentIndex !== -1) {
                // Look at current and next 3 verses
                candidates = verses.slice(currentIndex, currentIndex + 4);
            }
        } else {
            // Look at first 5 verses initially
            candidates = verses.slice(0, 5);
        }

        const bestMatch = MatchingService.findBestMatch(result.transcript, candidates);

        if (bestMatch && bestMatch.confidence > 0.35) { // Lenient threshold
            const verseNumber = bestMatch.verse.number;

            // Only update if it's a new verse or higher confidence
            if (matchedVerseId !== verseNumber) {
                setMatchedVerseId(verseNumber);
                setMatchConfidence(bestMatch.confidence);

                // Track recited verses (avoid duplicates in sequence)
                setVersesRecited(prev => {
                    const lastVerse = prev[prev.length - 1];
                    if (lastVerse !== verseNumber) {
                        return [...prev, verseNumber];
                    }
                    return prev;
                });

                // Haptic feedback for new verse match
                if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                }
            }
        } else {
            setMatchedVerseId(null);
            setMatchConfidence(0);
        }
    }, [verses, matchedVerseId]);

    const handleError = useCallback((error: string) => {
        console.error('Voice recognition error:', error);
        Alert.alert('Recognition Error', error);
        stopSession();
    }, []);

    const startSession = async () => {
        if (!canStartSession()) {
            Alert.alert(
                'Follow Along Limit Reached',
                `Free users can use Follow Along ${FREE_SESSIONS_PER_DAY} times per day. Upgrade to Pro for unlimited access!`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Upgrade to Pro',
                        onPress: () => router.push('/paywall?reason=follow_along'),
                    },
                ]
            );
            return;
        }

        const started = await VoiceRecognitionService.startListening(
            handleResult,
            handleError
        );

        if (started) {
            setIsActive(true);
            setIsListening(true);
            setVersesRecited([]);
            sessionStartTime.current = new Date();
            await incrementSessionCount();
        } else {
            // If failed to start (e.g. permissions), ensure state is clean
            setIsActive(false);
            setIsListening(false);
        }
    };

    const stopSession = async (): Promise<FollowAlongSession | null> => {
        await VoiceRecognitionService.stopListening();

        const endTime = new Date();
        let session: FollowAlongSession | null = null;

        // Create session object (even if specific verses weren't matched, to show effort)
        if (sessionStartTime.current && surahId) {
            session = {
                id: `session_${Date.now()}`,
                surahId,
                surahName: surahName || 'Unknown',
                surahNameArabic: surahNameArabic || '',
                startedAt: sessionStartTime.current,
                endedAt: endTime,
                versesRecited: versesRecited, // might be empty
                totalVerses: verses.length,
                accuracyPercentage: versesRecited.length > 0 ? calculateSessionAccuracy(versesRecited, verses.length) : 0,
                durationSeconds: calculateSessionDuration(sessionStartTime.current, endTime),
            };

            try {
                await repository.current.saveSession(session);
            } catch (error) {
                console.error('Failed to save session:', error);
            }
        }

        // Reset state
        setIsActive(false);
        setIsListening(false);
        setTranscript('');
        setMatchedVerseId(null);
        setMatchConfidence(0);
        setVersesRecited([]);
        sessionStartTime.current = null;

        return session;
    };

    return {
        isActive,
        isListening,
        transcript,
        matchedVerseId,
        matchConfidence,
        sessionsRemaining: isPro ? Infinity : Math.max(0, FREE_SESSIONS_PER_DAY - sessionsUsedToday),
        versesRecited,
        currentSessionDuration,
        startSession,
        stopSession,
        canStartSession: canStartSession(),
    };
}
