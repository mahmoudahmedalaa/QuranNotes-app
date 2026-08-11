/**
 * NoorAIScreen — Premium chat interface for the Noor AI companion.
 *
 * Flagship chat with:
 *  - Clean, minimal header with Noor avatar
 *  - Premium gradient chat bubbles
 *  - Card-style suggestion chips with icons
 *  - Frosted glass input bar
 *  - Typed, safe backend states and cited answers
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';


import { NoorMessage, VerseContext, NoorAIParams } from '../domain/types';
import { askNoor, getSuggestedQuestions } from '../domain/NoorAIService';
import {
    createUserMessage,
    createNoorMessage,
    createGreetingMessage,
    createVerseGreetingMessage,
} from '../domain/NoorChatStore';
import {
    saveConversation,
    loadConversation,
} from '../domain/NoorConversationHistory';
import { getNoorStatusPresentation } from '../domain/NoorStatusPresentation';

import NoorChatBubble from './NoorChatBubble';
import NoorTypingIndicator from './NoorTypingIndicator';
import NoorSuggestionChips from './NoorSuggestionChips';
import NoorConversationList from './NoorConversationList';
import { Spacing } from '../../../core/theme/DesignSystem';
import { AsyncGenerationGuard } from '../domain/AsyncGenerationGuard';

export default function NoorAIScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as NoorAIParams;

    // ── State ──
    const [messages, setMessages] = useState<NoorMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [transientError, setTransientError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const inFlightRef = useRef(false);
    const requestGenerationRef = useRef(new AsyncGenerationGuard());
    const requestGeneration = requestGenerationRef.current;

    useEffect(() => () => {
        requestGeneration.invalidate();
        inFlightRef.current = false;
    }, [requestGeneration]);

    // ── Build verse context from params ──
    const verseContext: VerseContext | undefined = useMemo(() => (
        params.surahNumber && params.verseNumber
            ? {
                surahNumber: parseInt(params.surahNumber, 10),
                surahName: params.surahName || '',
                verseNumber: parseInt(params.verseNumber, 10),
                arabicText: params.arabicText,
                translation: params.translation,
            }
            : undefined
    ), [params.arabicText, params.surahName, params.surahNumber, params.translation, params.verseNumber]);

    // ── Initialize: load existing conversation or create greeting ──
    useEffect(() => {
        const init = async () => {
            // Check if resuming a past conversation
            if (params.conversationId) {
                const conv = await loadConversation(params.conversationId as string);
                if (conv) {
                    setMessages(conv.messages);
                    setConversationId(conv.id);
                    return;
                }
            }

            // New conversation
            const greeting = verseContext
                ? createVerseGreetingMessage(verseContext)
                : createGreetingMessage();
            setMessages([greeting]);

            // If an initial question was passed, auto-send it
            if (params.initialQuestion) {
                setTimeout(() => {
                    handleSend(params.initialQuestion!);
                }, 600);
            }
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Resume a past conversation from the history list ──
    const handleResumeConversation = useCallback(async (id: string) => {
        requestGeneration.invalidate();
        inFlightRef.current = false;
        setIsLoading(false);
        const resumeGeneration = requestGeneration.next();
        const conv = await loadConversation(id);
        if (conv && requestGeneration.isCurrent(resumeGeneration)) {
            setMessages(conv.messages);
            setConversationId(conv.id);
            setShowHistory(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
    }, [requestGeneration]);

    // ── Suggested questions ──
    const suggestedQuestions = getSuggestedQuestions(verseContext);

    // ── Send message ──
    const handleSend = useCallback(
        async (textOverride?: string) => {
            const text = (textOverride || inputText).trim();
            if (!text || inFlightRef.current) return;
            inFlightRef.current = true;
            const generation = requestGeneration.next();

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Keyboard.dismiss();
            setTransientError(null);

            // Add user message
            const userMsg = createUserMessage(text, verseContext);
            setMessages((prev) => [...prev, userMsg]);
            setInputText('');
            setIsLoading(true);

            // Scroll to bottom
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

            try {
                const history = [...messages, userMsg].filter((m) => m.role !== 'noor' || messages.indexOf(m) > 0);
                const response = await askNoor(text, history, undefined, verseContext);
                if (!requestGeneration.isCurrent(generation)) return;
                const presentation = getNoorStatusPresentation(response);
                const safeResponse = response.status === 'answered'
                    ? response
                    : { ...response, answer: presentation.message };
                const noorMsg = createNoorMessage(safeResponse, false, verseContext);
                const updatedMessages = [...messages, userMsg, noorMsg];
                setMessages(updatedMessages);

                // Persist conversation
                const savedId = await saveConversation(conversationId, updatedMessages, verseContext);
                if (!requestGeneration.isCurrent(generation)) return;
                if (!conversationId) setConversationId(savedId);
                if (presentation.action === 'paywall') {
                    router.push('/paywall?reason=noor-ai' as never);
                }
            } catch {
                if (requestGeneration.isCurrent(generation)) {
                    setTransientError('Noor is temporarily unavailable. Your message was not sent. Please try again.');
                }
            } finally {
                if (requestGeneration.isCurrent(generation)) {
                    inFlightRef.current = false;
                    setIsLoading(false);
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
                }
            }
        },
        [inputText, messages, verseContext, conversationId, router, requestGeneration],
    );

    // ── Derived: can send ──
    const canSend = inputText.trim().length > 0 && !isLoading;

    // ── Render ──
    return (
        <View style={[styles.container, { backgroundColor: theme.dark ? '#09090B' : '#FAFAFF' }]}>
            {/* ── Clean Header ── */}
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: insets.top + 4,
                        backgroundColor: theme.dark ? '#09090B' : '#FAFAFF',
                        borderBottomColor: theme.dark ? '#27272A' : '#E2E8F0',
                    },
                ]}
            >
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        style={({ pressed }) => [
                            styles.backButton,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.12)'
                                    : 'rgba(98, 70, 234, 0.08)',
                            },
                            pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={24}
                            color={theme.colors.primary}
                        />
                    </Pressable>

                    {/* Noor identity */}
                    <View style={styles.headerIdentity}>
                        <View
                            style={[
                                styles.headerAvatar,
                                {
                                    backgroundColor: theme.dark
                                        ? 'rgba(167, 139, 250, 0.15)'
                                        : 'rgba(98, 70, 234, 0.1)',
                                },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="creation"
                                size={16}
                                color={theme.colors.primary}
                            />
                        </View>
                        <View>
                            <Text
                                style={[
                                    styles.headerTitle,
                                    { color: theme.colors.onSurface },
                                ]}
                            >
                                Noor AI
                            </Text>
                            <Text
                                style={[
                                    styles.headerSubtitle,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}
                            >
                                {verseContext
                                    ? `${verseContext.surahName} · Verse ${verseContext.verseNumber}`
                                    : 'Your Quran Companion'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        {/* History */}
                        <Pressable
                            disabled={isLoading}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowHistory(true);
                            }}
                            hitSlop={8}
                            style={({ pressed }) => [
                                styles.headerIconBtn,
                                {
                                    backgroundColor: theme.dark
                                        ? 'rgba(167, 139, 250, 0.12)'
                                        : 'rgba(98, 70, 234, 0.08)',
                                },
                                (pressed || isLoading) && { opacity: 0.7 },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="history"
                                size={18}
                                color={theme.colors.primary}
                            />
                        </Pressable>

                    </View>
                </View>
            </View>

            {/* ── Chat Messages ── */}
            <KeyboardAvoidingView
                style={styles.chatArea}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(m) => m.id}
                    renderItem={({ item, index }) => (
                        <NoorChatBubble
                            message={item}
                            isLatest={index === messages.length - 1}
                        />
                    )}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() =>
                        flatListRef.current?.scrollToEnd({ animated: true })
                    }
                    ListFooterComponent={
                        <>
                            {isLoading && <NoorTypingIndicator />}

                            {/* Show suggestion chips when conversation is idle */}
                            {!isLoading && messages.length <= 2 && (
                                <NoorSuggestionChips
                                    questions={suggestedQuestions}
                                    onSelect={(q) => handleSend(q)}
                                />
                            )}
                        </>
                    }
                />

                {transientError && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Retry sending your Noor question"
                        onPress={() => handleSend(messages.filter((message) => message.role === 'user').at(-1)?.content)}
                        style={styles.transientError}
                    >
                        <Text style={{ color: theme.colors.error }}>{transientError}</Text>
                    </Pressable>
                )}

                {/* ── Premium Input Bar ── */}
                <View
                    style={[
                        styles.inputBar,
                        {
                            backgroundColor: theme.dark ? '#0F0F12' : '#FFFFFF',
                            borderTopColor: theme.dark ? '#27272A' : '#E2E8F0',
                            paddingBottom: Math.max(insets.bottom, 12),
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.inputRow,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(255,255,255,0.06)'
                                    : '#F5F3FF',
                                borderColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.15)'
                                    : 'rgba(98, 70, 234, 0.12)',
                            },
                        ]}
                    >
                        <TextInput
                            style={[
                                styles.textInput,
                                { color: theme.colors.onSurface },
                            ]}
                            placeholder="Ask Noor anything…"
                            placeholderTextColor={theme.colors.onSurfaceVariant}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                            onSubmitEditing={() => handleSend()}
                            blurOnSubmit
                            editable={!isLoading}
                        />
                        <Pressable
                            onPress={() => handleSend()}
                            disabled={!canSend}
                            style={({ pressed }) => [
                                styles.sendButton,
                                canSend && { backgroundColor: theme.colors.primary },
                                pressed && canSend && { opacity: 0.85, transform: [{ scale: 0.92 }] },
                            ]}
                        >
                            {canSend ? (
                                <LinearGradient
                                    colors={
                                        theme.dark
                                            ? ['#A78BFA', '#7C3AED'] as const
                                            : ['#6246EA', '#7C3AED'] as const
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.sendGradient}
                                >
                                    <MaterialCommunityIcons
                                        name="send"
                                        size={18}
                                        color="#FFFFFF"
                                    />
                                </LinearGradient>
                            ) : (
                                <View
                                    style={[
                                        styles.sendGradient,
                                        {
                                            backgroundColor: theme.dark
                                                ? 'rgba(255,255,255,0.06)'
                                                : 'rgba(98, 70, 234, 0.08)',
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name="send"
                                        size={18}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </View>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* ── Conversation History Modal ── */}
            <NoorConversationList
                visible={showHistory}
                onDismiss={() => setShowHistory(false)}
                onSelectConversation={handleResumeConversation}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // ── Clean Header ──
    header: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerIdentity: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    usageBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    usageText: {
        fontSize: 12,
        fontWeight: '700',
    },
    transientError: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    // ── Chat ──
    chatArea: {
        flex: 1,
    },
    messageList: {
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    // ── Input ──
    inputBar: {
        paddingHorizontal: Spacing.md,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 24,
        borderWidth: 1,
        paddingLeft: 16,
        paddingRight: 4,
        paddingVertical: 4,
        gap: 4,
    },
    textInput: {
        flex: 1,
        minHeight: 36,
        maxHeight: 100,
        fontSize: 15,
        lineHeight: 20,
        paddingVertical: 8,
    },
    sendButton: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    sendGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
