/**
 * TadabburPausePhase — Guided meditation with sequential flow.
 *
 * v7 — FASTER PACING, still soothing:
 *  - Breathing circle is absolutely centered and NEVER moves
 *  - Guide text occupies a fixed-height zone below the circle
 *  - Snappier text transitions (1.2s fade-in, 0.8s fade-out)
 *  - One breathing cycle instead of two
 *  - Sub-phases play sequentially with brisk-but-calm timings
 *
 *  1. SETTLE_IN    — 6s  — "Find a comfortable position…"
 *  2. BREATHING    — 14s — Single breathing cycle: in … hold … out
 *  3. PREPARING    — 4s  — "Listen with your heart…"
 *  4. EYES_CLOSED  — 4s  — "Gently close your eyes…" then audio starts
 *  5. LISTENING    — Until audio ends — Minimal UI, wave motion
 *  6. SETTLING     — 8s  — "Let the verse settle…"
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Dimensions,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import { BreathingCircle } from './components/BreathingCircle';
import { SoothingWave } from './components/SoothingWave';
import { useTadabbur } from '../infrastructure/TadabburContext';
import {
    playVerseRecitation,
    fadeOutAndStop,
} from '../infrastructure/TadabburAudioService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Sub-phase definitions ──────────────────────────────────────────────────
type SubPhase =
    | 'SETTLE_IN'
    | 'BREATHING'
    | 'PREPARING'
    | 'EYES_CLOSED'
    | 'LISTENING'
    | 'SETTLING';

// Brisk-but-calm timings — meditative without dragging
const SETTLE_IN_DURATION   = 6000;   // 6s — welcome, settle in
const BREATHING_DURATION   = 14000;  // 14s — one clean breath cycle
const PREPARING_DURATION   = 4000;   // 4s — "listen with your heart"
const EYES_CLOSED_DURATION = 4000;   // 4s — "close your eyes" (last instruction, then silence)
const SETTLING_DURATION    = 8000;   // 8s — post-recitation silence

// Breathing cycle — one smooth inhale/hold/exhale
const BREATHING_STEPS = [
    { text: 'Breathe in…',     at: 0 },
    { text: 'Hold gently…',    at: 4500 },
    { text: 'And slowly out…', at: 7000 },
    { text: 'Let it flow…',    at: 10000 },
];

// ── Text transition durations ──────────────────────────────────────────────
const TEXT_FADE_IN   = 1200;  // Smooth but not sluggish
const TEXT_FADE_OUT  = 800;   // Quick, clean fade out

export const TadabburPausePhase: React.FC = () => {
    const theme = useTheme();
    const { dispatch, currentPassage, audioState } = useTadabbur();
    const mountedRef = useRef(true);

    const [subPhase, setSubPhase] = useState<SubPhase>('SETTLE_IN');
    const [guideText, setGuideText] = useState('');

    // ── Brand colors ────────────────────────────────────────────────────
    const guideColor = theme.dark ? '#E9E5FF' : '#1C1033';
    const mutedText = theme.dark ? '#A1A1AA' : '#94A3B8';
    const dotColor = theme.dark ? 'rgba(196,181,253,0.7)' : 'rgba(139,92,246,0.5)';

    // ── Complete the entire pause phase ─────────────────────────────────
    const completePhase = useCallback(() => {
        if (mountedRef.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            fadeOutAndStop(800);
            dispatch({ type: 'PAUSE_COMPLETE' });
        }
    }, [dispatch]);

    // ── Main orchestrator — runs the whole sequence ─────────────────────
    useEffect(() => {
        mountedRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const timers: ReturnType<typeof setTimeout>[] = [];

        const schedule = (fn: () => void, delay: number) => {
            const t = setTimeout(() => { if (mountedRef.current) fn(); }, delay);
            timers.push(t);
            return t;
        };

        let elapsed = 0;

        // ── SUB-PHASE 1: SETTLE_IN ──────────────────────────────────────
        setGuideText('Find a comfortable position…');
        schedule(() => {
            setGuideText('Let go of your surroundings…');
        }, 3000);
        elapsed += SETTLE_IN_DURATION;

        // ── SUB-PHASE 2: BREATHING ──────────────────────────────────────
        schedule(() => {
            setSubPhase('BREATHING');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, elapsed);

        // Schedule each breathing prompt
        BREATHING_STEPS.forEach((step) => {
            schedule(() => {
                setGuideText(step.text);
                if (step.text) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }, elapsed + step.at);
        });
        elapsed += BREATHING_DURATION;

        // ── SUB-PHASE 3: PREPARING ──────────────────────────────────────
        schedule(() => {
            setSubPhase('PREPARING');
            setGuideText('Listen with your heart\nand reflect…');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, elapsed);
        elapsed += PREPARING_DURATION;

        // ── SUB-PHASE 4: EYES_CLOSED ────────────────────────────────────
        // "Close your eyes" is the LAST instruction — no announcement after.
        // Audio begins naturally from silence (Headspace best practice).
        schedule(() => {
            setSubPhase('EYES_CLOSED');
            setGuideText('Gently close your eyes…');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, elapsed);

        // Clear the text after a few seconds — let silence prepare the user
        schedule(() => {
            if (mountedRef.current) {
                setGuideText('');
            }
        }, elapsed + 4000);
        elapsed += EYES_CLOSED_DURATION;

        // ── SUB-PHASE 5: LISTENING (starts audio) ───────────────────────
        schedule(() => {
            setSubPhase('LISTENING');
            setGuideText('');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            if (currentPassage) {
                playVerseRecitation(
                    currentPassage.surahNumber,
                    currentPassage.startVerse,
                    currentPassage.endVerse,
                ).then(() => {
                    if (mountedRef.current) {
                        setSubPhase('SETTLING');
                        setGuideText('Let the words of Allah\nsettle within you…');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                        const settleTimer = setTimeout(() => {
                            if (mountedRef.current) completePhase();
                        }, SETTLING_DURATION);
                        timers.push(settleTimer);
                    }
                }).catch((e) => {
                    if (__DEV__) console.warn('[TadabburPause] Recitation error:', e);
                    if (mountedRef.current) completePhase();
                });
            } else {
                setTimeout(() => { if (mountedRef.current) completePhase(); }, 3000);
            }
        }, elapsed);

        // Safety net — 180s max
        const safetyTimer = setTimeout(() => {
            if (mountedRef.current) completePhase();
        }, 180000);
        timers.push(safetyTimer);

        return () => {
            mountedRef.current = false;
            timers.forEach(clearTimeout);
            fadeOutAndStop(400);
        };
    }, [dispatch, currentPassage, completePhase]);

    const handleSkip = () => {
        fadeOutAndStop(300);
        dispatch({ type: 'PAUSE_COMPLETE' });
    };

    const isReciting = audioState.recitationState === 'playing' || audioState.recitationState === 'loading';

    // Verse reference text
    const verseRef = currentPassage
        ? `${currentPassage.surahName || 'Surah ' + currentPassage.surahNumber} · ${
            currentPassage.startVerse === currentPassage.endVerse
                ? `Verse ${currentPassage.startVerse}`
                : `Verses ${currentPassage.startVerse}-${currentPassage.endVerse}`
        }`
        : '';

    // ── RENDER ──────────────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Wave motion — always visible, stronger during listening */}
            <SoothingWave height={280} opacity={subPhase === 'LISTENING' ? 0.85 : 0.65} />

            {/* ── Breathing circle — FIXED in upper-center, never moves ── */}
            <View style={styles.circleZone}>
                <AnimatePresence>
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', duration: 2000 }}
                    >
                        <BreathingCircle
                            size={160}
                        />
                    </MotiView>
                </AnimatePresence>

                {/* Audio indicator dots — inside circle zone, won't shift layout */}
                {subPhase === 'LISTENING' && isReciting && (
                    <View style={styles.dotsRow}>
                        {[0, 1, 2].map((i) => (
                            <MotiView
                                key={i}
                                from={{ scale: 0.4, opacity: 0.3 }}
                                animate={{ scale: 1, opacity: 0.9 }}
                                transition={{
                                    type: 'timing',
                                    duration: 700,
                                    delay: i * 250,
                                    loop: true,
                                }}
                                style={[styles.dot, { backgroundColor: dotColor }]}
                            />
                        ))}
                    </View>
                )}
            </View>

            {/* ── Guide text zone — FIXED height below circle, never shifts ── */}
            <View style={styles.textZone}>
                <AnimatePresence exitBeforeEnter>
                    {guideText ? (
                        <MotiView
                            key={guideText}
                            from={{ opacity: 0, translateY: 12 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            exit={{ opacity: 0, translateY: -8 }}
                            transition={{ type: 'timing', duration: TEXT_FADE_IN }}
                            exitTransition={{ type: 'timing', duration: TEXT_FADE_OUT }}
                            style={styles.textWrapper}
                        >
                            <Text style={[styles.guideTextLarge, { color: guideColor }]}>
                                {guideText}
                            </Text>
                        </MotiView>
                    ) : (
                        <MotiView
                            key="empty"
                            from={{ opacity: 0 }}
                            animate={{ opacity: 0 }}
                            style={styles.textWrapper}
                        />
                    )}
                </AnimatePresence>

                {/* Subtle status during listening */}
                {subPhase === 'LISTENING' && (
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ type: 'timing', duration: 2500, delay: 3000 }}
                    >
                        <Text style={[styles.guideTextSmall, { color: mutedText }]}>
                            {isReciting ? 'Listening…' : 'Loading recitation…'}
                        </Text>
                    </MotiView>
                )}
            </View>

            {/* ── Bottom info zone — verse ref + selection reason ── */}
            <View style={styles.bottomInfoZone}>
                {/* Verse reference (phases 3+) */}
                {verseRef && ['PREPARING', 'EYES_CLOSED', 'LISTENING', 'SETTLING'].includes(subPhase) && (
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        transition={{ type: 'timing', duration: 2000, delay: 1500 }}
                    >
                        <Text style={[styles.verseRef, { color: guideColor }]}>
                            {verseRef}
                        </Text>
                    </MotiView>
                )}

                {/* Selection reason during settling */}
                {subPhase === 'SETTLING' && currentPassage?.selectionReason && (
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 0.7 }}
                        transition={{ type: 'timing', duration: 2000, delay: 2000 }}
                    >
                        <Text style={[styles.reasonText, { color: guideColor }]}>
                            &quot;{currentPassage.selectionReason}&quot;
                        </Text>
                    </MotiView>
                )}
            </View>

            {/* Skip — subtle pill at the bottom, never affects layout above */}
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 1200, delay: 6000 }}
                style={styles.skipContainer}
            >
                <Pressable
                    onPress={handleSkip}
                    style={({ pressed }) => [
                        styles.skipPill,
                        { borderColor: mutedText + '40' },
                        pressed && { opacity: 0.5 },
                    ]}
                >
                    <MaterialCommunityIcons name="skip-forward" size={14} color={mutedText} />
                    <Text style={[styles.skipLabel, { color: mutedText }]}>
                        Skip to verse
                    </Text>
                </Pressable>
            </MotiView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // ── Circle zone: absolutely positioned in upper-center ────────────
    circleZone: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        // Takes up ~55% of screen height, centers the circle within it
        height: SCREEN_HEIGHT * 0.50,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Text zone: fixed-height area below the circle ─────────────────
    textZone: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.44,
        left: 0,
        right: 0,
        height: SCREEN_HEIGHT * 0.22,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 36,
    },
    textWrapper: {
        position: 'absolute',
        left: 36,
        right: 36,
        alignItems: 'center',
    },

    // ── Bottom info zone ──────────────────────────────────────────────
    bottomInfoZone: {
        position: 'absolute',
        top: SCREEN_HEIGHT * 0.66,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 36,
        gap: 8,
    },

    // ── Text styles ──────────────────────────────────────────────────
    guideTextLarge: {
        fontSize: 26,
        fontWeight: '400',
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 40,
        letterSpacing: 0.4,
    },
    guideTextSmall: {
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 20,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    verseRef: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
    },
    reasonText: {
        fontSize: 15,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 22,
        paddingHorizontal: 20,
    },

    // ── Skip button ──────────────────────────────────────────────────
    skipContainer: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
    },
    skipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
    },
    skipLabel: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.3,
    },
});
