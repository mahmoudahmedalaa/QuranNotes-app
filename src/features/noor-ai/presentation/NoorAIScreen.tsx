/**
 * NoorAIScreen — Flagship chat interface for the Noor AI companion.
 *
 * Full-screen chat with:
 *  - Premium gradient header with "Noor AI ✨" branding
 *  - Chat bubbles with Noor avatar
 *  - Suggested question chips
 *  - Typing indicator while Gemini responds
 *  - Free/Pro usage gating
 *
 * Accepts optional route params for verse-context deep linking.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { NoorMessage, VerseContext, NoorAIParams } from '../domain/types';
import { askNoor, getSuggestedQuestions } from '../domain/NoorAIService';
import {
    createUserMessage,
    createNoorMessage,
    createGreetingMessage,
    createVerseGreetingMessage,
} from '../domain/NoorChatStore';
import {
    canSendMessage,
    recordMessageSent,
    getRemainingMessages,
    DAILY_LIMIT,
} from '../domain/NoorUsageService';
import {
    saveConversation,
    loadConversation,
} from '../domain/NoorConversationHistory';
import { usePro } from '../../auth/infrastructure/ProContext';

import NoorChatBubble from './NoorChatBubble';
import NoorTypingIndicator from './NoorTypingIndicator';
import NoorSuggestionChips from './NoorSuggestionChips';
import NoorConversationList from './NoorConversationList';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

export default function NoorAIScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { isPro } = usePro();
    const params = useLocalSearchParams<NoorAIParams>();

    // ── State ──
    const [messages, setMessages] = useState<NoorMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [remainingMsgs, setRemainingMsgs] = useState(DAILY_LIMIT);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // ── Build verse context from params ──
    const verseContext: VerseContext | undefined =
        params.surahNumber && params.verseNumber
            ? {
                surahNumber: parseInt(params.surahNumber, 10),
                surahName: params.surahName || '',
                verseNumber: parseInt(params.verseNumber, 10),
                arabicText: params.arabicText,
                translation: params.translation,
            }
            : undefined;

    // ── Initialize: load existing conversation or create greeting ──
    useEffect(() => {
        const init = async () => {
            // Check if resuming a past conversation
            if (params.conversationId) {
                const conv = await loadConversation(params.conversationId as string);
                if (conv) {
                    setMessages(conv.messages);
                    setConversationId(conv.id);
                    if (!isPro) {
                        const remaining = await getRemainingMessages();
                        setRemainingMsgs(remaining);
                    }
                    return;
                }
            }

            // New conversation
            const greeting = verseContext
                ? createVerseGreetingMessage(verseContext)
                : createGreetingMessage();
            setMessages([greeting]);

            if (!isPro) {
                getRemainingMessages().then(setRemainingMsgs);
            }

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
        const conv = await loadConversation(id);
        if (conv) {
            setMessages(conv.messages);
            setConversationId(conv.id);
            setShowHistory(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
    }, []);

    // ── Suggested questions ──
    const suggestedQuestions = getSuggestedQuestions(verseContext);

    // ── Send message ──
    const handleSend = useCallback(
        async (textOverride?: string) => {
            const text = (textOverride || inputText).trim();
            if (!text || isLoading) return;

            // Usage check for free users
            if (!isPro) {
                const allowed = await canSendMessage();
                if (!allowed) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Show upgrade nudge
                    const nudge = createNoorMessage(
                        `You've used all ${DAILY_LIMIT} free messages today. Upgrade to **Pro** for unlimited Noor AI conversations! 🌟`,
                    );
                    setMessages((prev) => [...prev, nudge]);
                    return;
                }
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Keyboard.dismiss();

            // Add user message
            const userMsg = createUserMessage(text, verseContext);
            setMessages((prev) => [...prev, userMsg]);
            setInputText('');
            setIsLoading(true);

            // Scroll to bottom
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

            try {
                // Pass all previous messages as conversation history
                const history = [...messages, userMsg].filter((m) => m.role !== 'noor' || messages.indexOf(m) > 0);
                const response = await askNoor(text, history, undefined, verseContext);

                // Create Noor response
                const noorMsg = createNoorMessage(response.answer, response.cached, verseContext);
                const updatedMessages = [...messages, userMsg, noorMsg];
                setMessages(updatedMessages);

                // Persist conversation
                const savedId = await saveConversation(conversationId, updatedMessages, verseContext);
                if (!conversationId) setConversationId(savedId);

                // Record usage for free users
                if (!isPro) {
                    await recordMessageSent();
                    const remaining = await getRemainingMessages();
                    setRemainingMsgs(remaining);
                }
            } catch (e) {
                const errorMsg = createNoorMessage(
                    'I had trouble connecting. Please check your internet and try again. 🤲',
                );
                setMessages((prev) => [...prev, errorMsg]);
            } finally {
                setIsLoading(false);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
            }
        },
        [inputText, isLoading, isPro, messages, verseContext, conversationId],
    );

    // ── Render ──
    const headerGradient: readonly [string, string, ...string[]] = theme.dark
        ? ['#1E1A2E', '#09090B']
        : ['#6246EA', '#4B2FD4'];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* ── Premium Header ── */}
            <LinearGradient colors={headerGradient} style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <View style={styles.headerRow}>
                    <Pressable
                        onPress={() => router.back()}
                        hitSlop={12}
                        style={styles.backButton}
                    >
                        <MaterialCommunityIcons name="chevron-left" size={28} color="#FFFFFF" />
                    </Pressable>

                    <View style={styles.headerCenter}>
                        <View style={styles.headerTitleRow}>
                            <MaterialCommunityIcons
                                name="star-four-points"
                                size={18}
                                color="rgba(255,255,255,0.9)"
                            />
                            <Text style={styles.headerTitle}>Noor AI</Text>
                            <Text style={styles.sparkle}>✨</Text>
                        </View>
                        <Text style={styles.headerSubtitle}>
                            {verseContext
                                ? `${verseContext.surahName} · Verse ${verseContext.verseNumber}`
                                : 'Your Quran Companion'}
                        </Text>
                    </View>

                    <View style={styles.headerActions}>
                        {/* History button */}
                        <Pressable
                            onPress={() => setShowHistory(true)}
                            hitSlop={8}
                            style={styles.historyButton}
                        >
                            <MaterialCommunityIcons name="history" size={20} color="rgba(255,255,255,0.85)" />
                        </Pressable>

                        {/* Usage badge for free users */}
                        {!isPro && (
                            <View style={styles.usageBadge}>
                                <Text style={styles.usageText}>
                                    {remainingMsgs}/{DAILY_LIMIT}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </LinearGradient>

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

                {/* ── Input Bar ── */}
                <View
                    style={[
                        styles.inputBar,
                        {
                            backgroundColor: theme.dark
                                ? 'rgba(255,255,255,0.06)'
                                : '#FFFFFF',
                            borderTopColor: theme.colors.outline,
                            paddingBottom: Math.max(insets.bottom, 12),
                        },
                    ]}
                >
                    <TextInput
                        style={[
                            styles.textInput,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(255,255,255,0.08)'
                                    : '#F8F5FF',
                                color: theme.colors.onSurface,
                            },
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
                        disabled={!inputText.trim() || isLoading}
                        style={({ pressed }) => [
                            styles.sendButton,
                            {
                                backgroundColor:
                                    inputText.trim() && !isLoading
                                        ? theme.colors.primary
                                        : theme.dark
                                            ? 'rgba(255,255,255,0.08)'
                                            : 'rgba(98, 70, 234, 0.12)',
                                opacity: pressed ? 0.8 : 1,
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="send"
                            size={20}
                            color={
                                inputText.trim() && !isLoading
                                    ? '#FFFFFF'
                                    : theme.colors.onSurfaceVariant
                            }
                        />
                    </Pressable>
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
    // ── Header ──
    header: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    headerCenter: {
        flex: 1,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sparkle: {
        fontSize: 16,
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    historyButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    usageBadge: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    usageText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
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
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 8,
    },
    textInput: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        lineHeight: 20,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
    },
});
