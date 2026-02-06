import { useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable, Dimensions } from 'react-native';
import {
    Text,
    useTheme,
    FAB,
    Portal,
    Dialog,
    TextInput,
    Button,
    IconButton,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useFolders } from '../../../src/infrastructure/notes/FolderContext';
import { Folder, DEFAULT_FOLDER } from '../../../src/domain/entities/Folder';
import { Spacing, BorderRadius, Shadows } from '../../../src/presentation/theme/DesignSystem';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function FoldersScreen() {
    const theme = useTheme();
    const { folders, addFolder, updateFolder, deleteFolder } = useFolders();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
    const [folderName, setFolderName] = useState('');

    const handleCreate = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingFolder(null);
        setFolderName('');
        setDialogVisible(true);
    };

    const handleEdit = (folder: Folder) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEditingFolder(folder);
        setFolderName(folder.name);
        setDialogVisible(true);
    };

    const handleSave = async () => {
        if (!folderName.trim()) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (editingFolder) {
            await updateFolder(editingFolder.id, { name: folderName.trim() });
        } else {
            await addFolder(folderName.trim());
        }
        setDialogVisible(false);
        setFolderName('');
        setEditingFolder(null);
    };

    const handleDelete = (folder: Folder) => {
        Alert.alert(
            'Delete Folder',
            `Delete "${folder.name}"? Items in this folder will be unassigned.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        deleteFolder(folder.id);
                    },
                },
            ],
        );
    };

    const renderFolder = ({ item }: { item: Folder }) => {
        const isDefault = item.id === DEFAULT_FOLDER.id;

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.md,
                    pressed && styles.cardPressed,
                ]}
                onPress={() => !isDefault && handleEdit(item)}>
                <LinearGradient
                    colors={[item.color + '15', item.color + '05']}
                    style={styles.iconContainer}>
                    <Ionicons name="folder" size={24} color={item.color} />
                </LinearGradient>

                <View style={styles.cardContent}>
                    <Text style={[styles.folderName, { color: theme.colors.onSurface }]}>
                        {item.name}
                    </Text>
                    {isDefault ? (
                        <Text style={[styles.defaultBadge, { color: theme.colors.primary }]}>
                            System Folder
                        </Text>
                    ) : (
                        <Text
                            style={[styles.defaultBadge, { color: theme.colors.onSurfaceVariant }]}>
                            Custom Label
                        </Text>
                    )}
                </View>

                {!isDefault && (
                    <IconButton
                        icon="dots-vertical"
                        size={20}
                        iconColor={theme.colors.onSurfaceVariant}
                        onPress={() => handleEdit(item)}
                    />
                )}
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}>
                    Organize your notes and recordings into folders
                </Text>
            </View>

            <FlatList
                data={folders}
                renderItem={renderFolder}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <IconButton
                            icon="folder-plus-outline"
                            size={56}
                            iconColor={theme.colors.onSurfaceVariant}
                        />
                        <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                            No folders yet
                        </Text>
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            Create folders to organize your content.
                        </Text>
                    </View>
                }
            />

            <FAB
                icon="plus"
                style={[styles.fab, { backgroundColor: theme.colors.primary }, Shadows.lg]}
                color="#FFF"
                onPress={handleCreate}
            />

            <Portal>
                <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
                    <Dialog.Title>{editingFolder ? 'Edit Folder' : 'New Folder'}</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Folder Name"
                            value={folderName}
                            onChangeText={setFolderName}
                            mode="outlined"
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleSave}>{editingFolder ? 'Save' : 'Create'}</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    headerText: {
        fontSize: 14,
        lineHeight: 20,
    },
    list: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.xl, // More rounded
        borderWidth: 1,
        borderColor: 'rgba(150, 150, 150, 0.05)', // Subtle border
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    iconContainer: {
        width: 52, // Slightly larger
        height: 52,
        borderRadius: 16, // Squircle look
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    cardContent: { flex: 1 },
    folderName: {
        fontSize: 17, // Slightly larger
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    defaultBadge: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
        opacity: 0.7,
    },
    actions: {
        flexDirection: 'row',
    },
    empty: { alignItems: 'center', paddingTop: Spacing.xxl },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: Spacing.sm },
    emptyText: { fontSize: 14, textAlign: 'center', marginTop: Spacing.xs },
    fab: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
    },
});
