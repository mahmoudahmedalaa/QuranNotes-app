import React, { useState } from 'react';
import { View, StyleSheet, Modal, FlatList, Pressable } from 'react-native';
import { Text, useTheme, Searchbar, IconButton, Button, Divider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Folder, DEFAULT_FOLDER } from '../../../domain/entities/Folder';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

interface FolderPickerProps {
    visible: boolean;
    onDismiss: () => void;
    onSelect: (folderId: string | undefined) => void;
    selectedFolderId?: string;
    folders: Folder[];
}

export function FolderPicker({
    visible,
    onDismiss,
    onSelect,
    selectedFolderId,
    folders,
}: FolderPickerProps) {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleSelect = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelect(id === DEFAULT_FOLDER.id ? undefined : id);
        onDismiss();
    };

    const renderFolder = ({ item }: { item: Folder }) => (
        <Pressable
            style={({ pressed }) => [
                styles.folderItem,
                selectedFolderId === item.id && { backgroundColor: item.color + '20' },
                pressed && { opacity: 0.7 },
            ]}
            onPress={() => handleSelect(item.id)}>
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Ionicons
                    name={item.id === DEFAULT_FOLDER.id ? 'remove-circle-outline' : 'folder'}
                    size={20}
                    color={item.color}
                />
            </View>
            <Text
                style={[
                    styles.folderName,
                    { color: theme.colors.onSurface },
                    selectedFolderId === item.id && { fontWeight: '700' },
                ]}>
                {item.name}
            </Text>
            {selectedFolderId === item.id && (
                <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
            )}
        </Pressable>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <Pressable style={styles.dismissArea} onPress={onDismiss} />
                <View style={[styles.content, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.header}>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            Select Folder
                        </Text>
                        <IconButton icon="close" size={20} onPress={onDismiss} />
                    </View>

                    <Searchbar
                        placeholder="Search folders..."
                        onChangeText={setSearchQuery}
                        value={searchQuery}
                        style={styles.searchbar}
                        inputStyle={{ fontSize: 14 }}
                        elevation={0}
                    />

                    <FlatList
                        data={filteredFolders}
                        renderItem={renderFolder}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        ItemSeparatorComponent={() => <Divider style={{ opacity: 0.5 }} />}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    content: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        maxHeight: '70%',
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    searchbar: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        borderRadius: BorderRadius.lg,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    list: {
        paddingHorizontal: Spacing.md,
    },
    folderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    folderName: {
        flex: 1,
        fontSize: 16,
    },
});
