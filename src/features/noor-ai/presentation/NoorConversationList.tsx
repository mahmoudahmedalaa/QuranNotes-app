/**
 * NoorConversationList — Slide-up modal showing past Noor AI conversations.
 *
 * Uses React Native's built-in Modal (renders at native window level, above
 * everything — including fullScreenModal screens). No dependency on gorhom
 * bottom-sheet, which has known stacking issues inside native modals.
 *
 * Features:
 *  - Animated slide-up panel with spring physics
 *  - Tap backdrop to dismiss
 *  - Tap conversation to resume
 *  - Long-press to delete
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    Alert,
    Modal,
    Animated,
    FlatList,
    Dimensions,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadConversations, deleteConversation } from '../domain/NoorConversationHistory';
import { VerseContext } from '../domain/types';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.65;

interface ConversationSummary {
    id: string;
    title: string;
    messageCount: number;
    lastMessage: string;
    updatedAt: number;
    verseContext?: VerseContext;
}

interface Props {
    visible: boolean;
    onDismiss: () => void;
    onSelectConversation: (conversationId: string) => void;
}

function formatDate(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

export default function NoorConversationList({ visible, onDismiss, onSelectConversation }: Props) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    const slideAnim = useRef(new Animated.Value(PANEL_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const convos = await loadConversations();
            setConversations(convos);
        } catch {
            setConversations([]);
        }
        setLoading(false);
    }, []);

    // Open
    useEffect(() => {
        if (visible) {
            refresh();
            setModalVisible(true);
            // Animate in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Animate out
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: PANEL_HEIGHT,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setModalVisible(false);
            });
        }
    }, [visible, refresh, slideAnim, backdropAnim]);

    const handleDismiss = useCallback(() => {
        onDismiss();
    }, [onDismiss]);

    const handleDelete = useCallback(
        (id: string, title: string) => {
            Alert.alert('Delete Conversation', `Remove "${title}"?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        await deleteConversation(id);
                        refresh();
                    },
                },
            ]);
        },
        [refresh],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: ConversationSummary; index: number }) => (
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 200, delay: index * 50 }}
            >
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelectConversation(item.id);
                        handleDismiss();
                    }}
                    onLongPress={() => handleDelete(item.id, item.title)}
                    style={({ pressed }) => [
                        styles.card,
                        {
                            backgroundColor: theme.dark
                                ? 'rgba(255,255,255,0.06)'
                                : '#F8F5FF',
                            opacity: pressed ? 0.8 : 1,
                        },
                    ]}
                >
                    <View style={styles.cardLeft}>
                        <MaterialCommunityIcons
                            name={item.verseContext ? 'book-open-page-variant' : 'chat'}
                            size={20}
                            color={theme.colors.primary}
                        />
                    </View>
                    <View style={styles.cardContent}>
                        <Text
                            style={[styles.cardTitle, { color: theme.colors.onSurface }]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        <Text
                            style={[styles.cardPreview, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={1}
                        >
                            {item.lastMessage}
                        </Text>
                    </View>
                    <View style={styles.cardRight}>
                        <Text style={[styles.cardDate, { color: theme.colors.onSurfaceVariant }]}>
                            {formatDate(item.updatedAt)}
                        </Text>
                        <Text style={[styles.cardCount, { color: theme.colors.onSurfaceVariant }]}>
                            {item.messageCount} msgs
                        </Text>
                    </View>
                </Pressable>
            </MotiView>
        ),
        [theme, onSelectConversation, handleDelete, handleDismiss],
    );

    return (
        <Modal
            visible={modalVisible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleDismiss}
        >
            {/* Backdrop */}
            <Animated.View
                style={[
                    styles.backdrop,
                    { opacity: backdropAnim },
                ]}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
            </Animated.View>

            {/* Slide-up Panel */}
            <Animated.View
                style={[
                    styles.panel,
                    {
                        height: PANEL_HEIGHT,
                        backgroundColor: theme.dark ? '#1A1A2E' : '#FFFFFF',
                        paddingBottom: Math.max(insets.bottom, 16),
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Drag handle indicator */}
                <View style={styles.handleRow}>
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: theme.dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' },
                        ]}
                    />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <MaterialCommunityIcons
                            name="history"
                            size={22}
                            color={theme.colors.primary}
                        />
                        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                            Past Conversations
                        </Text>
                    </View>
                    <Pressable onPress={handleDismiss} hitSlop={12}>
                        <MaterialCommunityIcons
                            name="close"
                            size={22}
                            color={theme.colors.onSurfaceVariant}
                        />
                    </Pressable>
                </View>

                {/* List */}
                {!loading && conversations.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons
                            name="chat-outline"
                            size={48}
                            color={theme.colors.outline}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            No past conversations yet.{'\n'}Start chatting with Noor!
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={conversations}
                        keyExtractor={(c) => c.id}
                        renderItem={renderItem}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={true}
                        indicatorStyle={theme.dark ? 'white' : 'black'}
                    />
                )}
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    panel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        // iOS shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        // Android elevation
        elevation: 24,
    },
    handleRow: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.2)',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    list: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: BorderRadius.lg,
        marginBottom: 8,
    },
    cardLeft: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(98, 70, 234, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardContent: {
        flex: 1,
        marginRight: 8,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    cardPreview: {
        fontSize: 13,
        marginTop: 2,
    },
    cardRight: {
        alignItems: 'flex-end',
    },
    cardDate: {
        fontSize: 11,
        fontWeight: '500',
    },
    cardCount: {
        fontSize: 11,
        marginTop: 2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 14,
        marginTop: 12,
        lineHeight: 20,
    },
});
