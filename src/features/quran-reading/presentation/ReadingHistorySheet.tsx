/**
 * ReadingHistorySheet — Bottom sheet showing recent reading/listening sessions.
 * Opened via long-press on GlobalMiniPlayer.
 * Each row shows surah name, verse, relative timestamp, and source icon.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { ReadingHistoryService, ReadingHistoryEntry } from '../infrastructure/ReadingHistoryService';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';
import { useAuth } from '../../auth/infrastructure/AuthContext';

interface Props {
    onClose: () => void;
}

function getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

export const ReadingHistorySheet: React.FC<Props> = ({ onClose }) => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        ReadingHistoryService.getHistory(userId)
            .then(setHistory)
            .finally(() => setLoading(false));
    }, [userId]);

    const handleEntryPress = (entry: ReadingHistoryEntry) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        // Small delay so the modal closes before navigating
        setTimeout(() => {
            router.push(`/surah/${entry.surah}?verse=${entry.verse}` as any);
        }, 300);
    };

    const renderEntry = ({ item, index }: { item: ReadingHistoryEntry; index: number }) => (
        <MotiView
            from={{ opacity: 0, translateX: -10 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'spring', damping: 20, delay: index * 30 }}
        >
            <Pressable
                onPress={() => handleEntryPress(item)}
                style={({ pressed }) => [
                    styles.entryRow,
                    { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
                ]}
            >
                <View style={[
                    styles.sourceIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                ]}>
                    <MaterialCommunityIcons
                        name={item.source === 'audio' ? 'headphones' : 'book-open-variant'}
                        size={18}
                        color={theme.colors.primary}
                    />
                </View>
                <View style={styles.entryInfo}>
                    <Text style={[styles.entryTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {item.surahName || `Surah ${item.surah}`}
                    </Text>
                    <Text style={[styles.entrySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Verse {item.verse} · {getRelativeTime(item.timestamp)}
                    </Text>
                </View>
                <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                />
            </Pressable>
        </MotiView>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
            {/* Handle bar */}
            <View style={styles.handleBar}>
                <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                    Reading History
                </Text>
                <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    style={({ pressed }) => [
                        styles.closeButton,
                        { backgroundColor: theme.colors.surfaceVariant },
                        pressed && { opacity: 0.7 },
                    ]}
                >
                    <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
                </Pressable>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        Loading...
                    </Text>
                </View>
            ) : history.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons
                        name="book-open-page-variant-outline"
                        size={48}
                        color={theme.colors.outlineVariant}
                    />
                    <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                        No reading history yet
                    </Text>
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        Your recent reading and listening sessions will appear here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item, index) => `${item.surah}-${item.timestamp}-${index}`}
                    renderItem={renderEntry}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => (
                        <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    handleBar: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 4,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: 12,
    },
    sourceIcon: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entryInfo: {
        flex: 1,
    },
    entryTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    entrySubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: Spacing.lg + 52, // align with text, past icon
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
