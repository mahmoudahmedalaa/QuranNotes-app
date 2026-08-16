/**
 * TadabburClosingPhase — Premium session complete screen.
 *
 * v4 — Calm/Headspace-inspired, Tadabbur-specific:
 *  1. Gradient background — deep spiritual purple → dark
 *  2. Verse-centric hero — the actual verse reflected on, beautifully typeset
 *  3. "Tadabbur Complete ✦" — specific, not generic
 *  4. Compact stat pills — time, reflections, streak in one row
 *  5. Shareable card — captures verse + stats, opens native share sheet
 *  6. Premium full-width Done button
 *  7. FloatingParticles + SoothingWave ambient layers
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { FloatingParticles } from './components/FloatingParticles';
import { SoothingWave } from './components/SoothingWave';
import { useTadabbur } from '../infrastructure/TadabburContext';
import { getSessionDuration } from '../infrastructure/TadabburSessionEngine';
import { stopAll as stopTadabburAudio } from '../infrastructure/TadabburAudioService';

// ── Rotating quotes — Prophetic wisdom about dhikr & reflection ─────────
const INSPIRATIONAL_QUOTES = [
    { arabic: 'إِنَّ فِي ذَٰلِكَ لَذِكْرَىٰ لِمَن كَانَ لَهُ قَلْبٌ', english: 'Indeed in that is a reminder for whoever has a heart' },
    { arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', english: 'Verily, in the remembrance of Allah do hearts find rest' },
    { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', english: 'Remember Me, and I will remember you' },
    { arabic: 'وَلَذِكْرُ اللَّهِ أَكْبَرُ', english: 'And the remembrance of Allah is greater' },
    { arabic: 'كِتَابٌ أَنزَلْنَاهُ إِلَيْكَ مُبَارَكٌ لِّيَدَّبَّرُوا آيَاتِهِ', english: 'A blessed Book We have sent down to you, that they may reflect upon its verses' },
    { arabic: 'أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ', english: 'Do they not reflect upon the Quran?' },
];



// ── Share card constants (360 × 450 = 4:5 ratio) ────────────────────────
const SC_W = 360;
const SC_H = 450;

const SHARE_STAR_POSITIONS = [
    { top: SC_H * 0.06, left: SC_W * 0.08, size: 3, opacity: 0.5 },
    { top: SC_H * 0.12, left: SC_W * 0.82, size: 2.5, opacity: 0.4 },
    { top: SC_H * 0.25, left: SC_W * 0.92, size: 2, opacity: 0.3 },
    { top: SC_H * 0.55, left: SC_W * 0.05, size: 2, opacity: 0.3 },
    { top: SC_H * 0.70, left: SC_W * 0.90, size: 2.5, opacity: 0.4 },
    { top: SC_H * 0.88, left: SC_W * 0.15, size: 3, opacity: 0.5 },
    { top: SC_H * 0.92, left: SC_W * 0.85, size: 2, opacity: 0.35 },
    { top: SC_H * 0.04, left: SC_W * 0.50, size: 2, opacity: 0.3 },
];

// ── Adaptive Arabic text sizing for share card ──────────────────────────
const getShareArabicSize = (text: string) => {
    const len = text.length;
    if (len <= 30) return { fontSize: 24, lineHeight: 42 };
    if (len <= 60) return { fontSize: 22, lineHeight: 38 };
    if (len <= 100) return { fontSize: 19, lineHeight: 34 };
    if (len <= 160) return { fontSize: 17, lineHeight: 30 };
    return { fontSize: 15, lineHeight: 26 };
};

export const TadabburClosingPhase: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const { session, stats, completeSession, activeTrack } = useTadabbur();
    const shareCardRef = useRef<ViewShot>(null);

    const duration = getSessionDuration(session);
    const minutes = Math.max(1, Math.round(duration / 60));
    const reflectionCount = session.reflections.length;
    const streak = stats.currentStreak;

    // Get the first passage for the verse hero
    const passage = useMemo(() => {
        if (activeTrack?.passages?.length) return activeTrack.passages[0];
        return null;
    }, [activeTrack]);



    // Pick a random quote once per mount
    const quote = useMemo(
        () => INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)],
        [],
    );

    // ── Colors ──────────────────────────────────────────────────────────
    const accent       = theme.dark ? '#C4B5FD' : '#8B5CF6';
    const accentDim    = theme.dark ? 'rgba(196,181,253,0.5)' : 'rgba(139,92,246,0.4)';
    const accentSoft   = theme.dark ? 'rgba(196,181,253,0.10)' : 'rgba(139,92,246,0.06)';
    const heading      = theme.dark ? '#F5F3FF' : '#1C1033';
    const body         = theme.dark ? '#D4D4D8' : '#1F2937';
    const muted        = theme.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)';
    const pillBg       = theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const pillBorder   = theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

    const streakColor  = theme.dark ? '#FCD34D' : '#F59E0B';

    // Gradient stops
    const gradientColors = theme.dark
        ? ['#1a0a2e', '#0f0720', '#0a0514'] as const
        : ['#f5f0ff', '#ede5ff', '#e8deff'] as const;

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        stopTadabburAudio();
    }, []);



    const handleDone = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await completeSession();
        router.back();
    }, [completeSession, router]);

    const handleShare = useCallback(async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (!shareCardRef.current) return;
            const uri = await captureRef(shareCardRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    UTI: 'public.png',
                });
            }
        } catch (e) {
            // Silent fail — share is optional
            if (__DEV__) console.warn('[TadabburClosing] Share failed:', e);
        }
    }, []);

    // Verse reference text
    const verseRef = useMemo(() => {
        if (!passage) return '';
        const name = passage.surahName || `Surah ${passage.surahNumber}`;
        return passage.startVerse === passage.endVerse
            ? `${name}, Verse ${passage.startVerse}`
            : `${name}, Verses ${passage.startVerse}–${passage.endVerse}`;
    }, [passage]);

    return (
        <LinearGradient colors={[...gradientColors]} style={styles.container}>
            {/* Ambient layers */}
            <SoothingWave height={200} opacity={0.3} />
            <FloatingParticles count={14} />

            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* ── Decorative ornament ───────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 16, delay: 100 }}
                    style={styles.ornamentRow}
                >
                    <Text style={[styles.ornament, { color: accentDim }]}>✦</Text>
                </MotiView>

                {/* ── Header text ───────────────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0, translateY: 12 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 800, delay: 200 }}
                    style={styles.headerBlock}
                >
                    <Text style={[styles.title, { color: heading }]}>
                        Tadabbur Complete
                    </Text>
                    <Text style={[styles.subtitle, { color: body }]}>
                        تقبل الله · May Allah accept your reflection
                    </Text>
                </MotiView>

                {/* ── Verse Hero ────────────────────────────────────────── */}
                {passage?.arabicText ? (
                    <MotiView
                        from={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'timing', duration: 1200, delay: 400 }}
                        style={styles.verseHero}
                    >
                        {/* Soft glow behind the verse */}
                        <View style={[styles.verseGlow, { backgroundColor: accent + '12' }]} />

                        <Text style={[styles.verseArabic, { color: heading }]}>
                            {passage.arabicText}
                        </Text>
                        {passage.translationText && (
                            <Text style={[styles.verseTranslation, { color: body }]} numberOfLines={3}>
                                &quot;{passage.translationText}&quot;
                            </Text>
                        )}
                        {verseRef ? (
                            <Text style={[styles.verseCaption, { color: muted }]}>
                                — {verseRef}
                            </Text>
                        ) : null}
                    </MotiView>
                ) : null}

                {/* ── Stat pills row ───────────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 600, delay: 650 }}
                    style={styles.pillRow}
                >
                    <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
                        <MaterialCommunityIcons name="timer-outline" size={14} color={accent} />
                        <Text style={[styles.pillText, { color: heading }]}>
                            {minutes} {minutes === 1 ? 'min' : 'mins'}
                        </Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
                        <MaterialCommunityIcons name="note-text-outline" size={14} color={accent} />
                        <Text style={[styles.pillText, { color: heading }]}>
                            {reflectionCount} {reflectionCount === 1 ? 'reflection' : 'reflections'}
                        </Text>
                    </View>
                    {streak > 0 && (
                        <View style={[styles.pill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
                            <Text style={styles.streakEmoji}>🔥</Text>
                            <Text style={[styles.pillText, { color: streakColor }]}>
                                {streak}-day
                            </Text>
                        </View>
                    )}
                </MotiView>

                {/* ── Inspirational quote ───────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 700, delay: 850 }}
                    style={styles.quoteBlock}
                >
                    <Text style={[styles.quoteArabic, { color: accent }]}>{quote.arabic}</Text>
                    <Text style={[styles.quoteEnglish, { color: body }]}>&quot;{quote.english}&quot;</Text>
                </MotiView>



                {/* ── Share button ──────────────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 500, delay: 1150 }}
                >
                    <Pressable
                        onPress={handleShare}
                        style={({ pressed }) => [
                            styles.shareBtn,
                            { borderColor: pillBorder, opacity: pressed ? 0.6 : 1 },
                        ]}
                    >
                        <MaterialCommunityIcons name="share-variant-outline" size={16} color={accent} />
                        <Text style={[styles.shareBtnText, { color: accent }]}>
                            Share your reflection
                        </Text>
                    </Pressable>
                </MotiView>

                {/* ── Done button ──────────────────────────────────────── */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 500, delay: 1300 }}
                    style={styles.doneContainer}
                >
                    <Pressable
                        onPress={handleDone}
                        style={({ pressed }) => [
                            styles.doneBtn,
                            { opacity: pressed ? 0.8 : 1 },
                        ]}
                    >
                        <LinearGradient
                            colors={theme.dark
                                ? ['rgba(124,58,237,0.6)', 'rgba(109,40,217,0.5)']
                                : ['rgba(139,92,246,0.55)', 'rgba(124,58,237,0.45)']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.doneBtnGradient}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                            <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                        </LinearGradient>
                    </Pressable>
                </MotiView>
            </ScrollView>
            </SafeAreaView>

            {/* ── Hidden premium share card (captured by react-native-view-shot) ── */}
            <View style={styles.offscreen}>
                <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
                    <View style={styles.shareCard}>
                        <LinearGradient
                            colors={['#0F0A2A', '#1A0D3A', '#2D1F6E', '#1A0D3A', '#0F0A2A']}
                            locations={[0, 0.25, 0.5, 0.75, 1]}
                            style={styles.shareCardInner}
                        >
                            {/* Star dots — ambient decoration */}
                            {SHARE_STAR_POSITIONS.map((star, i) => (
                                <View
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        top: star.top,
                                        left: star.left,
                                        width: star.size,
                                        height: star.size,
                                        borderRadius: star.size / 2,
                                        backgroundColor: '#A78BFA',
                                        opacity: star.opacity,
                                    }}
                                />
                            ))}

                            {/* Header ornament */}
                            <Text style={styles.scOrnament}>✦</Text>
                            <Text style={styles.scLabel}>TADABBUR SESSION</Text>

                            {/* Thin decorative divider */}
                            <View style={styles.scDivider} />

                            {/* Verse hero */}
                            {passage?.arabicText ? (
                                <Text
                                    style={[
                                        styles.scArabic,
                                        {
                                            fontSize: getShareArabicSize(passage.arabicText).fontSize,
                                            lineHeight: getShareArabicSize(passage.arabicText).lineHeight,
                                        },
                                    ]}
                                    adjustsFontSizeToFit
                                    numberOfLines={8}
                                >
                                    {passage.arabicText}
                                </Text>
                            ) : null}

                            {passage?.translationText ? (
                                <Text style={styles.scTranslation} numberOfLines={3}>
                                    &quot;{passage.translationText}&quot;
                                </Text>
                            ) : null}

                            {verseRef ? (
                                <Text style={styles.scVerseRef}>— {verseRef}</Text>
                            ) : null}

                            {/* Thin decorative divider */}
                            <View style={styles.scDivider} />

                            {/* Frosted stat pills */}
                            <View style={styles.scStatsRow}>
                                <View style={styles.scStatPill}>
                                    <Text style={styles.scStatValue}>{minutes}</Text>
                                    <Text style={styles.scStatUnit}>{minutes === 1 ? 'min' : 'mins'}</Text>
                                </View>
                                <View style={styles.scStatSep} />
                                <View style={styles.scStatPill}>
                                    <Text style={styles.scStatValue}>{reflectionCount}</Text>
                                    <Text style={styles.scStatUnit}>{reflectionCount === 1 ? 'reflection' : 'reflections'}</Text>
                                </View>
                                {streak > 1 ? (
                                    <>
                                        <View style={styles.scStatSep} />
                                        <View style={styles.scStatPill}>
                                            <Text style={[styles.scStatValue, { color: '#FCD34D' }]}>🔥 {streak}</Text>
                                            <Text style={styles.scStatUnit}>day streak</Text>
                                        </View>
                                    </>
                                ) : null}
                            </View>



                            {/* Branded footer */}
                            <View style={styles.scFooter}>
                                <View style={styles.scFooterDivider} />
                                <View style={styles.scBrandRow}>
                                    <MaterialCommunityIcons name="book-open-page-variant" size={12} color="#A78BFA" />
                                    <Text style={styles.scBrandName}>QuranNotes</Text>
                                </View>
                                <Text style={styles.scBrandSub}>Tadabbur · Reflect · Grow</Text>
                            </View>
                        </LinearGradient>
                    </View>
                </ViewShot>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 60,
        gap: 28,
    },

    // ── Ornament ──────────────────────────────────────────────────────
    ornamentRow: {
        alignItems: 'center',
    },
    ornament: {
        fontSize: 32,
    },

    // ── Header ────────────────────────────────────────────────────────
    headerBlock: {
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 22,
    },

    // ── Verse Hero ────────────────────────────────────────────────────
    verseHero: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
        gap: 12,
        width: '100%',
    },
    verseGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
    },
    verseArabic: {
        fontSize: 26,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 42,
        letterSpacing: 0.5,
    },
    verseTranslation: {
        fontSize: 15,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 24,
        paddingHorizontal: 8,
    },
    verseCaption: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 4,
    },

    // ── Stat pills ────────────────────────────────────────────────────
    pillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    pillText: {
        fontSize: 14,
        fontWeight: '600',
    },
    streakEmoji: {
        fontSize: 14,
    },

    // ── Quote ─────────────────────────────────────────────────────────
    quoteBlock: {
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
    },
    quoteArabic: {
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 28,
    },
    quoteEnglish: {
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 20,
    },



    // ── Share ─────────────────────────────────────────────────────────
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
    },
    shareBtnText: {
        fontSize: 14,
        fontWeight: '500',
    },

    // ── Done ──────────────────────────────────────────────────────────
    doneContainer: {
        width: '100%',
        marginTop: 4,
    },
    doneBtn: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    doneBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
    },
    doneBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },

    // ── Premium share card (captured offscreen) ──────────────────────
    offscreen: {
        position: 'absolute',
        left: -9999,
        top: -9999,
    },
    shareCard: {
        width: SC_W,
        height: SC_H,
        borderRadius: 0,
        overflow: 'hidden',
    },
    shareCardInner: {
        flex: 1,
        padding: 28,
        paddingTop: 36,
        paddingBottom: 24,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    scOrnament: {
        fontSize: 22,
        color: '#C4B5FD',
        opacity: 0.6,
    },
    scLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 3,
        color: 'rgba(196,181,253,0.55)',
        textTransform: 'uppercase',
    },
    scDivider: {
        width: 40,
        height: 1,
        backgroundColor: 'rgba(196,181,253,0.2)',
        marginVertical: 4,
    },
    scArabic: {
        fontWeight: '500',
        color: '#F5F3FF',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    scTranslation: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    scVerseRef: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    scStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 6,
    },
    scStatPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    scStatValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E0D5FF',
    },
    scStatUnit: {
        fontSize: 10,
        color: 'rgba(196,181,253,0.6)',
        fontWeight: '500',
    },
    scStatSep: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(196,181,253,0.3)',
    },

    scFooter: {
        alignItems: 'center',
        gap: 8,
        marginTop: 'auto' as any,
        paddingTop: 8,
    },
    scFooterDivider: {
        width: 24,
        height: 1,
        backgroundColor: 'rgba(196,181,253,0.15)',
    },
    scBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    scBrandName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#C4B5FD',
        letterSpacing: 1.5,
    },
    scBrandSub: {
        fontSize: 9,
        color: 'rgba(196,181,253,0.45)',
        letterSpacing: 0.8,
    },
});
