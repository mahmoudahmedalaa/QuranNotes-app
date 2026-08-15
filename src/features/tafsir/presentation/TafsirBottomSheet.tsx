/**
 * TafsirBottomSheet — AI-first verse explanation + scholar's notes.
 *
 * Layout (top → bottom):
 *  1. Verse reference pill (surah · verse)
 *  2. Arabic text + translation
 *  3. Source picker (Ibn Kathir / Al-Sa'di)
 *  4. ✨ AI EXPLANATION — primary content (shimmer while loading)
 *  5. 📖 Scholar's Notes — collapsed accordion (raw tafsir)
 *  6. 💬 AI Q&A answer (if asked)
 *  7. Ask input + disclaimer
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useTheme, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { Spacing, BorderRadius, Shadows } from '../../../core/theme/DesignSystem';

import { TafsirSource, TafsirSheetData, DEFAULT_TAFSIR_SOURCE } from '../domain/types';
import { getTafsirCommentary } from '../data/TafsirDataService';
import { summarizeTafsir, askAboutVerse } from '../domain/TafsirService';
import { SourcePicker } from './SourcePicker';
import { AiQueryInput } from './AiQueryInput';
import NoorCitationList from '../../noor-ai/presentation/NoorCitationList';
import { NoorCitation } from '../../noor-ai/domain/generatedContract';
import { getNoorStatusPresentation } from '../../noor-ai/domain/NoorStatusPresentation';
import { AsyncGenerationGuard } from '../../noor-ai/domain/AsyncGenerationGuard';

const GOLD = '#D4A853';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SOURCE_PREF_KEY = 'tafsir_preferred_source';
const SCHOLAR_TRUNCATE = 500;

interface TafsirBottomSheetProps {
    visible: boolean;
    onDismiss: () => void;
    data: TafsirSheetData | null;
}

// ── Helpers ──

/** Clean raw tafsir text for mobile display. */
function cleanText(raw: string): string {
    let t = raw;
    t = t.replace(/<[^>]+>/g, '');
    t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n{3,}/g, '\n\n').trim();
    return t;
}

// ── Component ──

export const TafsirBottomSheet: React.FC<TafsirBottomSheetProps> = ({
    visible,
    onDismiss,
    data,
}) => {
    const theme = useTheme();
    // ── State ──
    const [source, setSource] = useState<TafsirSource>(DEFAULT_TAFSIR_SOURCE);
    const [rawCommentary, setRawCommentary] = useState<string | null>(null);
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiFailed, setAiFailed] = useState(false);
    const [scholarOpen, setScholarOpen] = useState(false);
    const [scholarExpanded, setScholarExpanded] = useState(false);
    const [aiAnswer, setAiAnswer] = useState<string | null>(null);
    const [explanationCitations, setExplanationCitations] = useState<NoorCitation[]>([]);
    const [answerCitations, setAnswerCitations] = useState<NoorCitation[]>([]);
    const [answerLoading, setAnswerLoading] = useState(false);

    // ── Paywall ──
    const router = useRouter();
    const [aiGated, setAiGated] = useState(false);
    const contextGenerationRef = useRef(new AsyncGenerationGuard());
    const questionGenerationRef = useRef(new AsyncGenerationGuard());
    const contextGeneration = contextGenerationRef.current;
    const questionGeneration = questionGenerationRef.current;

    // Restore preferred source
    useEffect(() => {
        AsyncStorage.getItem(SOURCE_PREF_KEY).then((val) => {
            if (val === 'ibn_kathir' || val === 'al_sadi') setSource(val);
        });
    }, []);

    // Load tafsir + auto-generate AI explanation
    useEffect(() => {
        if (!visible || !data) return;

        let cancelled = false;
        const summaryGeneration = contextGeneration.next();
        questionGeneration.invalidate();
        setAnswerLoading(false);

        setAiExplanation(null);
        setAiLoading(false);
        setAiFailed(false);
        setAiAnswer(null);
        setExplanationCitations([]);
        setAnswerCitations([]);
        setScholarOpen(false);
        setScholarExpanded(false);

        setRawCommentary(null);
        const result = getTafsirCommentary(source, data.surahNumber, data.verseNumber);
        const cleaned = result?.text ? cleanText(result.text) : null;
        setRawCommentary(cleaned);

        (async () => {
            setAiGated(false);
            setAiLoading(true);
            try {
                const response = await summarizeTafsir(
                    data.arabicText,
                    data.translation,
                    result?.text ?? '',
                    source,
                    data.surahName,
                    data.surahNumber,
                    data.verseNumber,
                );
                if (cancelled || !contextGeneration.isCurrent(summaryGeneration)) return;
                const presentation = getNoorStatusPresentation(response);
                setAiExplanation(response.status === 'answered' ? response.answer : presentation.message);
                setExplanationCitations(response.citations);
                setAiGated(presentation.action === 'paywall');
            } catch {
                if (!cancelled && contextGeneration.isCurrent(summaryGeneration)) setAiFailed(true);
            } finally {
                if (!cancelled && contextGeneration.isCurrent(summaryGeneration)) setAiLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            contextGeneration.invalidate();
            questionGeneration.invalidate();
        };
    }, [
        visible,
        data,
        data?.arabicText,
        data?.translation,
        data?.surahName,
        data?.surahNumber,
        data?.verseNumber,
        source,
        contextGeneration,
        questionGeneration,
    ]);

    const handleSourceChange = useCallback((newSource: TafsirSource) => {
        contextGeneration.invalidate();
        questionGeneration.invalidate();
        setSource(newSource);
        AsyncStorage.setItem(SOURCE_PREF_KEY, newSource);
    }, [contextGeneration, questionGeneration]);

    const handleAskQuestion = useCallback(
        async (question: string) => {
            if (!data) return;

            const questionContextGeneration = contextGeneration.current();
            const generation = questionGeneration.next();
            setAnswerCitations([]);
            setAnswerLoading(true);
            try {
                const result = await askAboutVerse(
                    question,
                    data.arabicText,
                    data.translation,
                    rawCommentary || '',
                    source,
                    data.surahName,
                    data.surahNumber,
                    data.verseNumber,
                );
                if (!contextGeneration.isCurrent(questionContextGeneration)
                    || !questionGeneration.isCurrent(generation)) return;
                const presentation = getNoorStatusPresentation(result);
                setAiAnswer(result.status === 'answered' ? result.answer : presentation.message);
                setAnswerCitations(result.citations);
                if (presentation.action === 'paywall') router.push('/paywall?reason=ai-tafsir' as never);
            } catch {
                if (contextGeneration.isCurrent(questionContextGeneration)
                    && questionGeneration.isCurrent(generation)) {
                    setAnswerCitations([]);
                    setAiAnswer('Unable to answer right now. Please try again.');
                }
            } finally {
                if (contextGeneration.isCurrent(questionContextGeneration)
                    && questionGeneration.isCurrent(generation)) setAnswerLoading(false);
            }
        },
        [data, rawCommentary, source, router, contextGeneration, questionGeneration],
    );

    // Truncated scholar text
    const scholarText = rawCommentary || '';
    const scholarTruncated =
        scholarText.length > SCHOLAR_TRUNCATE && !scholarExpanded
            ? scholarText.slice(0, SCHOLAR_TRUNCATE).replace(/\s+\S*$/, '') + '…'
            : scholarText;

    // CRITICAL: Always render the Modal so React Native can properly
    // dismiss it at the native level. If we return null before the Modal,
    // the native overlay stays active and blocks all touches.
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            {!data ? null : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                >
                    <View style={styles.backdrop}>
                        <Pressable style={styles.backdropPress} onPress={onDismiss} />

                        <MotiView
                            from={{ translateY: 500 }}
                            animate={{ translateY: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                            style={[
                                styles.sheet,
                                { backgroundColor: theme.colors.surface },
                                Shadows.lg,
                            ]}
                        >
                            {/* Handle */}
                            <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />

                            {/* Header */}
                            <View style={styles.header}>
                                <MaterialCommunityIcons name="book-open-variant" size={22} color={GOLD} />
                                <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                                    Tafsir
                                </Text>
                                <IconButton
                                    icon="close"
                                    size={20}
                                    onPress={onDismiss}
                                    iconColor={theme.colors.onSurfaceVariant}
                                />
                            </View>

                            {/* Verse pill */}
                            <View style={[styles.verseRef, { backgroundColor: `${GOLD}15` }]}>
                                <Text style={[styles.verseRefText, { color: GOLD }]}>
                                    {data.surahName} · Verse {data.verseNumber}
                                </Text>
                            </View>

                            {/* Source picker */}
                            <SourcePicker selected={source} onSelect={handleSourceChange} />

                            {/* ── Scrollable content ── */}
                            <ScrollView
                                style={styles.content}
                                contentContainerStyle={styles.contentContainer}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >


                                {/* ═══ SECTION 1: AI Explanation (PRIMARY) ═══ */}
                                <View style={[styles.sectionDivider, { borderTopColor: theme.colors.outlineVariant }]}>
                                    <MaterialCommunityIcons
                                        name="auto-fix"
                                        size={14}
                                        color={GOLD}
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={[styles.sectionLabel, { color: GOLD }]}>
                                        Explanation
                                    </Text>
                                </View>

                                {aiGated ? (
                                    /* Free-tier limit reached — show paywall prompt */
                                    <View style={styles.gatedContainer}>
                                        <MaterialCommunityIcons
                                            name="lock-outline"
                                            size={28}
                                            color={GOLD}
                                        />
                                        <Text style={[styles.gatedTitle, { color: theme.colors.onSurface }]}>
                                            Noor AI is available with Pro access
                                        </Text>
                                        <Text style={[styles.gatedSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                            Upgrade to Pro for Noor AI & Quran Explanations
                                        </Text>
                                        <Pressable
                                            onPress={() => router.push('/paywall?reason=ai-tafsir' as any)}
                                            style={[styles.unlockButton, { backgroundColor: GOLD }]}
                                        >
                                            <MaterialCommunityIcons name="auto-fix" size={16} color="#FFFFFF" />
                                            <Text style={styles.unlockButtonText}>Explore Pro Access</Text>
                                        </Pressable>
                                        <Text style={[styles.gatedReset, { color: theme.colors.onSurfaceVariant }]}>
                                            Includes up to 50 successful AI answers per UTC day.
                                        </Text>
                                    </View>
                                ) : aiLoading ? (
                                    /* Shimmer skeleton while loading */
                                    <View style={styles.skeletonContainer}>
                                        {[1, 2, 3, 4].map((i) => (
                                            <MotiView
                                                key={i}
                                                from={{ opacity: 0.3 }}
                                                animate={{ opacity: 0.7 }}
                                                transition={{
                                                    type: 'timing',
                                                    duration: 800,
                                                    loop: true,
                                                }}
                                                style={[
                                                    styles.skeletonLine,
                                                    {
                                                        backgroundColor: theme.colors.outlineVariant,
                                                        width: i === 4 ? '60%' : '100%',
                                                    },
                                                ]}
                                            />
                                        ))}
                                        <Text style={[styles.shimmerLabel, { color: theme.colors.onSurfaceVariant }]}>
                                            Understanding this verse…
                                        </Text>
                                    </View>
                                ) : aiExplanation ? (
                                    /* AI explanation loaded */
                                    <MotiView
                                        from={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ type: 'timing', duration: 400 }}
                                    >
                                        <Text style={[styles.explanationText, { color: theme.colors.onSurface }]}>
                                            {aiExplanation}
                                        </Text>
                                        <NoorCitationList citations={explanationCitations} />
                                    </MotiView>
                                ) : rawCommentary ? (
                                    /* AI failed — show cleaned raw text as fallback */
                                    <MotiView
                                        from={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ type: 'timing', duration: 400 }}
                                    >
                                        {aiFailed && (
                                            <View style={[styles.fallbackBanner, { backgroundColor: `${GOLD}12` }]}>
                                                <MaterialCommunityIcons
                                                    name="wifi-off"
                                                    size={14}
                                                    color={theme.colors.onSurfaceVariant}
                                                />
                                                <Text style={[styles.fallbackText, { color: theme.colors.onSurfaceVariant }]}>
                                                    AI unavailable — showing scholar{"'"}s commentary
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={[styles.explanationText, { color: theme.colors.onSurface }]}>
                                            {rawCommentary.length > SCHOLAR_TRUNCATE
                                                ? rawCommentary.slice(0, SCHOLAR_TRUNCATE).replace(/\s+\S*$/, '') + '…'
                                                : rawCommentary}
                                        </Text>
                                    </MotiView>
                                ) : (
                                    /* No commentary available at all */
                                    <View style={styles.emptyState}>
                                        <MaterialCommunityIcons
                                            name="book-open-page-variant-outline"
                                            size={28}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                                            Explanation is not yet available for this verse.
                                            {'\n'}You can still ask AI about it below.
                                        </Text>
                                    </View>
                                )}

                                {/* ═══ SECTION 2: Scholar's Notes (COLLAPSED ACCORDION) ═══ */}
                                {rawCommentary && aiExplanation && (
                                    <>
                                        <Pressable
                                            onPress={() => setScholarOpen(prev => !prev)}
                                            style={[
                                                styles.accordionHeader,
                                                { borderTopColor: theme.colors.outlineVariant },
                                            ]}
                                            hitSlop={4}
                                        >
                                            <MaterialCommunityIcons
                                                name="book-open-page-variant-outline"
                                                size={14}
                                                color={theme.colors.onSurfaceVariant}
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant, flex: 1 }]}>
                                                Scholar{"'"}s Notes
                                            </Text>
                                            <MaterialCommunityIcons
                                                name={scholarOpen ? 'chevron-up' : 'chevron-down'}
                                                size={18}
                                                color={theme.colors.onSurfaceVariant}
                                            />
                                        </Pressable>

                                        {scholarOpen && (
                                            <MotiView
                                                from={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ type: 'timing', duration: 300 }}
                                            >
                                                <Text style={[styles.scholarText, { color: theme.colors.onSurfaceVariant }]}>
                                                    {scholarTruncated}
                                                </Text>
                                                {scholarText.length > SCHOLAR_TRUNCATE && (
                                                    <Pressable
                                                        onPress={() => setScholarExpanded(prev => !prev)}
                                                        style={styles.readMoreBtn}
                                                        hitSlop={8}
                                                    >
                                                        <Text style={[styles.readMoreText, { color: GOLD }]}>
                                                            {scholarExpanded ? 'Show less' : 'Read more'}
                                                        </Text>
                                                    </Pressable>
                                                )}
                                            </MotiView>
                                        )}
                                    </>
                                )}

                                {/* ═══ SECTION 3: AI Q&A Answer ═══ */}
                                {aiAnswer && (
                                    <>
                                        <View style={[styles.sectionDivider, { borderTopColor: theme.colors.outlineVariant }]}>
                                            <MaterialCommunityIcons
                                                name="chat-processing-outline"
                                                size={14}
                                                color={GOLD}
                                                style={{ marginRight: 4 }}
                                            />
                                            <Text style={[styles.sectionLabel, { color: GOLD }]}>
                                                Answer
                                            </Text>
                                        </View>
                                        <MotiView
                                            from={{ opacity: 0, translateY: 10 }}
                                            animate={{ opacity: 1, translateY: 0 }}
                                            transition={{ type: 'spring', damping: 20 }}
                                        >
                                            <Text style={[styles.explanationText, { color: theme.colors.onSurface }]}>
                                                {aiAnswer}
                                            </Text>
                                            <NoorCitationList citations={answerCitations} />
                                        </MotiView>
                                    </>
                                )}
                            </ScrollView>

                            {/* AI query input */}
                            <AiQueryInput onSubmit={handleAskQuestion} loading={answerLoading} />

                            {/* Disclaimer */}
                            <View style={[styles.disclaimer, { borderTopColor: theme.colors.outlineVariant }]}>
                                <MaterialCommunityIcons
                                    name="information-outline"
                                    size={14}
                                    color={theme.colors.onSurfaceVariant}
                                />
                                <Text style={[styles.disclaimerText, { color: theme.colors.onSurfaceVariant }]}>
                                    AI-generated from verified tafsir. Consult a scholar for personal guidance.
                                </Text>
                            </View>
                        </MotiView>
                    </View>
                </KeyboardAvoidingView>
            )}
        </Modal>
    );
};

// ── Styles ──

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    backdrop: { flex: 1, justifyContent: 'flex-end' },
    backdropPress: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        minHeight: SCREEN_HEIGHT * 0.55,
        maxHeight: SCREEN_HEIGHT * 0.85,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        paddingBottom: Spacing.lg,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
    verseRef: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.xs,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
    },
    verseRefText: { fontSize: 12, fontWeight: '600' },
    content: { flex: 1, marginTop: Spacing.md },
    contentContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
    arabicText: {
        fontSize: 24,
        lineHeight: 42,
        textAlign: 'right',
        writingDirection: 'rtl',
        marginBottom: Spacing.sm,
    },
    translationText: {
        fontSize: 14,
        lineHeight: 22,
        fontStyle: 'italic',
        marginBottom: Spacing.md,
    },
    sectionDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: Spacing.md,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // ── AI Explanation (primary) ──
    explanationText: { fontSize: 15, lineHeight: 26 },

    // ── Skeleton shimmer ──
    skeletonContainer: { gap: 10, paddingVertical: Spacing.sm },
    skeletonLine: { height: 14, borderRadius: 4 },
    shimmerLabel: { fontSize: 12, fontWeight: '500', marginTop: 4 },

    // ── Fallback banner ──
    fallbackBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: BorderRadius.sm,
        marginBottom: Spacing.sm,
    },
    fallbackText: { fontSize: 12, fontWeight: '500' },

    // ── Scholar's Notes accordion ──
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: Spacing.md,
        marginTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    scholarText: { fontSize: 14, lineHeight: 22 },
    readMoreBtn: { marginTop: Spacing.xs, paddingVertical: 4 },
    readMoreText: { fontSize: 13, fontWeight: '600' },

    // ── Empty state ──
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

    // ── Disclaimer ──
    disclaimer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        marginTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    disclaimerText: { fontSize: 11, fontWeight: '500', flex: 1 },

    // ── Gated lock state ──
    gatedContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
    },
    gatedTitle: {
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
    gatedSubtitle: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.xl,
        marginTop: Spacing.xs,
    },
    unlockButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    gatedReset: {
        fontSize: 11,
        fontWeight: '500',
    },
    remainingText: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: Spacing.sm,
    },
});
