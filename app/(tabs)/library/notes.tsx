import { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme, Searchbar, IconButton, FAB } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNotes } from '../../../src/presentation/hooks/useNotes';
import { useFolders } from '../../../src/infrastructure/notes/FolderContext';
import { Note } from '../../../src/domain/entities/Note';
import { DEFAULT_FOLDER } from '../../../src/domain/entities/Folder';
import { Spacing, BorderRadius, Shadows } from '../../../src/presentation/theme/DesignSystem';
import { ModernDropdown } from '../../../src/presentation/components/common/ModernDropdown';
import * as Haptics from 'expo-haptics';

export default function NotesScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { notes, loading, fetchAllNotes } = useNotes();
    const { folders } = useFolders();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

    useEffect(() => {
        fetchAllNotes();
    }, [fetchAllNotes]);

    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFolder =
                selectedFolders.length === 0 ||
                selectedFolders.includes(note.folderId || DEFAULT_FOLDER.id);
            return matchesSearch && matchesFolder;
        });
    }, [notes, searchQuery, selectedFolders]);

    const folderOptions = folders.map(f => ({ label: f.name, value: f.id }));

    const handleNotePress = (item: Note) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/note/edit',
            params: { surah: item.surahId, verse: item.verseId, id: item.id },
        });
    };

    const renderItem = ({ item }: { item: Note }) => {
        const folder = folders.find(f => f.id === item.folderId);

        return (
            <Pressable
                onPress={() => handleNotePress(item)}
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.sm,
                    pressed && styles.cardPressed,
                ]}>
                <View style={styles.cardHeader}>
                    <View
                        style={[
                            styles.verseBadge,
                            { backgroundColor: theme.colors.primaryContainer },
                        ]}>
                        <Text style={[styles.verseBadgeText, { color: theme.colors.primary }]}>
                            {item.surahId}:{item.verseId || ''}
                        </Text>
                    </View>
                    {folder && (
                        <View
                            style={[styles.folderBadge, { backgroundColor: folder.color + '20' }]}>
                            <Text style={[styles.folderBadgeText, { color: folder.color }]}>
                                {folder.name}
                            </Text>
                        </View>
                    )}
                    <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                    </Text>
                </View>
                <View style={styles.cardBody}>
                    <Text
                        numberOfLines={3}
                        style={[styles.noteContent, { color: theme.colors.onSurface }]}>
                        {item.content}
                    </Text>
                    <IconButton
                        icon="pencil-outline"
                        size={20}
                        iconColor={theme.colors.outline}
                        style={styles.cardActionIcon}
                    />
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            {/* Filter Bar */}
            <View style={styles.filterBar}>
                <Searchbar
                    placeholder="Search notes..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
                    inputStyle={{ fontSize: 14 }}
                    iconColor={theme.colors.onSurfaceVariant}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                />
            </View>

            <View style={styles.folderFilter}>
                <ModernDropdown
                    label="Filter by folder"
                    value={selectedFolders}
                    options={folderOptions}
                    onSelect={value => setSelectedFolders(value as string[])}
                    multiSelect
                    icon="folder"
                />
            </View>

            <FlatList
                data={filteredNotes}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={fetchAllNotes}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <IconButton
                            icon="notebook-outline"
                            size={56}
                            iconColor={theme.colors.onSurfaceVariant}
                        />
                        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                            No notes yet
                        </Text>
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            {searchQuery
                                ? 'No matching notes found.'
                                : 'Start reading to add reflections.'}
                        </Text>
                    </View>
                }
            />

            {/* Floating Action Button for creating new note */}
            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                        pathname: '/note/edit',
                        params: { standalone: 'true' },
                    });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    filterBar: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
    },
    searchbar: {
        borderRadius: BorderRadius.lg,
        elevation: 0,
    },
    folderFilter: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    list: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.xxl,
    },
    card: {
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    cardPressed: {
        opacity: 0.95,
        transform: [{ scale: 0.99 }],
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: 8,
    },
    verseBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    verseBadgeText: {
        fontWeight: '700',
        fontSize: 12,
    },
    folderBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    folderBadgeText: {
        fontWeight: '600',
        fontSize: 11,
    },
    date: {
        fontSize: 11,
        marginLeft: 'auto',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noteContent: {
        flex: 1,
        fontSize: 14,
        lineHeight: 21,
    },
    cardActionIcon: {
        margin: 0,
        marginRight: -Spacing.xs,
    },
    empty: {
        alignItems: 'center',
        paddingTop: Spacing.xxl,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: Spacing.sm,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 16,
        borderRadius: BorderRadius.xl,
    },
});
