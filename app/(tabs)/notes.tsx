import { useEffect, useState, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import {
    Text,
    useTheme,
    Searchbar,
    TouchableRipple,
    IconButton,
    FAB,
    Portal,
    Dialog,
    TextInput,
    Button,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNotes } from '../../src/presentation/hooks/useNotes';
import { useFolders } from '../../src/infrastructure/notes/FolderContext';
import { Note } from '../../src/domain/entities/Note';
import { Spacing } from '../../src/presentation/theme/DesignSystem';
import { ModernDropdown } from '../../src/presentation/components/common/ModernDropdown';
import { FolderManagementDialog } from '../../src/presentation/components/common/FolderManagementDialog';

export default function NotesScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { notes, loading, fetchAllNotes } = useNotes();
    const { folders, addFolder, updateFolder, deleteFolder } = useFolders();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
    const [dialogVisible, setDialogVisible] = useState(false);

    useEffect(() => {
        fetchAllNotes();
    }, [fetchAllNotes]);

    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFolder =
                selectedFolders.length === 0 ||
                (note.folderId && selectedFolders.includes(note.folderId));
            return matchesSearch && matchesFolder;
        });
    }, [notes, searchQuery, selectedFolders]);

    const folderOptions = folders.map(f => ({ label: f.name, value: f.id }));

    const renderItem = ({ item }: { item: Note }) => {
        const folder = folders.find(f => f.id === item.folderId);

        return (
            <View style={[styles.cardContainer, { backgroundColor: theme.colors.surface }]}>
                <TouchableRipple
                    onPress={() =>
                        router.push({
                            pathname: '/note/edit',
                            params: { surah: item.surahId, verse: item.verseId, id: item.id },
                        })
                    }
                    style={styles.card}
                    rippleColor={theme.colors.primary}>
                    <View>
                        <View style={styles.cardHeader}>
                            <View
                                style={[
                                    styles.badge,
                                    { backgroundColor: theme.colors.primaryContainer },
                                ]}>
                                <Text
                                    style={[
                                        styles.badgeText,
                                        { color: theme.colors.onPrimaryContainer },
                                    ]}>
                                    {item.surahId}:{item.verseId || ''}
                                </Text>
                            </View>
                            {folder && (
                                <View
                                    style={[
                                        styles.folderBadge,
                                        { backgroundColor: folder.color + '20' },
                                    ]}>
                                    <Text style={[styles.folderText, { color: folder.color }]}>
                                        {folder.name}
                                    </Text>
                                </View>
                            )}
                            <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>
                                {new Date(item.updatedAt).toLocaleDateString()}
                            </Text>
                        </View>
                        <Text
                            variant="bodyLarge"
                            numberOfLines={3}
                            style={[styles.noteText, { color: theme.colors.onSurface }]}>
                            {item.content}
                        </Text>
                    </View>
                </TouchableRipple>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: Spacing.md,
                    }}>
                    <Text style={[styles.title, { color: theme.colors.primary, marginBottom: 0 }]}>
                        My Reflections
                    </Text>
                    <IconButton
                        icon="folder-plus"
                        mode="contained-tonal"
                        onPress={() => setDialogVisible(true)}
                        size={24}
                    />
                </View>

                <Searchbar
                    placeholder="Search notes..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={[styles.searchbar, { backgroundColor: theme.colors.background }]}
                />

                <ModernDropdown
                    label="Filter by Folder"
                    value={selectedFolders}
                    options={folderOptions}
                    onSelect={value => setSelectedFolders(value as string[])}
                    multiSelect
                    searchable
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
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <IconButton
                            icon="notebook-outline"
                            size={48}
                            iconColor={theme.colors.onSurfaceVariant}
                        />
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            {searchQuery
                                ? 'No matching notes found.'
                                : 'No notes yet.\nStart reading to add one!'}
                        </Text>
                    </View>
                }
            />

            <FolderManagementDialog
                visible={dialogVisible}
                onDismiss={() => setDialogVisible(false)}
                folders={folders}
                onCreate={async name => {
                    await addFolder(name);
                }}
                onRename={async (id, name) => {
                    await updateFolder(id, { name });
                }}
                onDelete={async id => {
                    const { Alert } = require('react-native');
                    Alert.alert(
                        'Delete Folder',
                        'Are you sure? Notes in this folder will be unassigned.',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                    await deleteFolder(id);
                                },
                            },
                        ],
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: Spacing.lg,
        paddingBottom: Spacing.md,
        elevation: 2,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    searchbar: {
        marginBottom: Spacing.md,
        elevation: 0,
        borderRadius: 12,
    },
    list: {
        padding: Spacing.lg,
    },
    cardContainer: {
        marginBottom: Spacing.md,
        borderRadius: 16,
        elevation: 2,
        overflow: 'hidden',
    },
    card: {
        padding: Spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontWeight: '700',
        fontSize: 12,
    },
    folderBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    folderText: {
        fontWeight: '600',
        fontSize: 11,
    },
    date: {
        fontSize: 12,
        marginLeft: 'auto',
    },
    noteText: {
        lineHeight: 22,
    },
    empty: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
