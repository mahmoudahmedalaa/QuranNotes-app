import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Pressable,
    RefreshControl,
    Alert,
} from 'react-native';
import { useTheme, Surface } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { FollowAlongSession } from '../../../src/domain/entities/FollowAlongSession';
import { LocalFollowAlongRepository } from '../../../src/data/local/LocalFollowAlongRepository';
import { Spacing, BorderRadius, Shadows } from '../../../src/presentation/theme/DesignSystem';

export default function FollowAlongsTab() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const [sessions, setSessions] = useState<FollowAlongSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const repository = new LocalFollowAlongRepository();

    const loadSessions = async () => {
        try {
            const allSessions = await repository.getAllSessions();
            setSessions(allSessions);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadSessions();
    }, []);

    const handleDelete = (session: FollowAlongSession) => {
        Alert.alert(
            'Delete Session',
            `Delete this ${session.surahName} session?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await repository.deleteSession(session.id);
                        setSessions(prev => prev.filter(s => s.id !== session.id));
                    },
                },
            ]
        );
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return 'Today';
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const renderSession = ({ item, index }: { item: FollowAlongSession; index: number }) => {
        const uniqueVerses = [...new Set(item.versesRecited)].length;

        return (
            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', delay: index * 50 }}>
                <Pressable
                    onLongPress={() => handleDelete(item)}
                    style={({ pressed }) => [
                        pressed && { opacity: 0.9 },
                    ]}>
                    <Surface
                        style={[
                            styles.sessionCard,
                            { backgroundColor: theme.colors.elevation.level2 },
                        ]}
                        elevation={1}>
                        {/* Header */}
                        <View style={styles.cardHeader}>
                            <View style={styles.surahInfo}>
                                <Text
                                    style={[
                                        styles.surahNameArabic,
                                        { color: theme.colors.primary },
                                    ]}>
                                    {item.surahNameArabic}
                                </Text>
                                <Text
                                    style={[
                                        styles.surahName,
                                        { color: theme.colors.onSurface },
                                    ]}>
                                    {item.surahName}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.accuracyBadge,
                                    {
                                        backgroundColor:
                                            item.accuracyPercentage > 70
                                                ? theme.colors.primaryContainer
                                                : item.accuracyPercentage > 40
                                                    ? theme.colors.tertiaryContainer
                                                    : theme.colors.errorContainer,
                                    },
                                ]}>
                                <Text
                                    style={[
                                        styles.accuracyText,
                                        {
                                            color:
                                                item.accuracyPercentage > 70
                                                    ? theme.colors.primary
                                                    : item.accuracyPercentage > 40
                                                        ? theme.colors.tertiary
                                                        : theme.colors.error,
                                        },
                                    ]}>
                                    {item.accuracyPercentage}%
                                </Text>
                            </View>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Ionicons
                                    name="book-outline"
                                    size={16}
                                    color={theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    style={[
                                        styles.statText,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {uniqueVerses} of {item.totalVerses} verses
                                </Text>
                            </View>
                            <View style={styles.stat}>
                                <Ionicons
                                    name="time-outline"
                                    size={16}
                                    color={theme.colors.onSurfaceVariant}
                                />
                                <Text
                                    style={[
                                        styles.statText,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {formatDuration(item.durationSeconds)}
                                </Text>
                            </View>
                        </View>

                        {/* Footer */}
                        <Text
                            style={[
                                styles.dateText,
                                { color: theme.colors.outline },
                            ]}>
                            {formatDate(item.startedAt)}
                        </Text>
                    </Surface>
                </Pressable>
            </MotiView>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring' }}>
                <View
                    style={[
                        styles.emptyIcon,
                        { backgroundColor: theme.colors.primaryContainer },
                    ]}>
                    <Ionicons
                        name="mic-circle-outline"
                        size={60}
                        color={theme.colors.primary}
                    />
                </View>
            </MotiView>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                No Follow Along Sessions
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Open a Surah and tap the microphone button to start following along with your recitation
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={sessions}
                keyExtractor={item => item.id}
                renderItem={renderSession}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + 100 },
                    sessions.length === 0 && styles.emptyListContent,
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[theme.colors.primary]}
                    />
                }
                ListEmptyComponent={!loading ? renderEmptyState : null}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    listContent: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    emptyListContent: {
        flex: 1,
        justifyContent: 'center',
    },
    sessionCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.xs,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    surahInfo: {
        flex: 1,
    },
    surahNameArabic: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 2,
    },
    surahName: {
        fontSize: 14,
        fontWeight: '500',
    },
    accuracyBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
    },
    accuracyText: {
        fontSize: 14,
        fontWeight: '700',
    },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        fontSize: 13,
    },
    dateText: {
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    emptySubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
});
