import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
    Dialog,
    Portal,
    Button,
    TextInput,
    List,
    IconButton,
    useTheme,
    Text,
} from 'react-native-paper';
import { Folder, DEFAULT_FOLDER } from '../../../domain/entities/Folder';

interface FolderManagementDialogProps {
    visible: boolean;
    onDismiss: () => void;
    folders: Folder[];
    onCreate: (name: string) => Promise<void>;
    onRename: (id: string, newName: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

export const FolderManagementDialog = ({
    visible,
    onDismiss,
    folders,
    onCreate,
    onRename,
    onDelete,
}: FolderManagementDialogProps) => {
    const theme = useTheme();
    const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
    const [folderName, setFolderName] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (visible) {
            setMode('list');
            setFolderName('');
            setSelectedFolderId(null);
        }
    }, [visible]);

    const handleCreate = async () => {
        if (folderName.trim()) {
            await onCreate(folderName.trim());
            setMode('list');
        }
    };

    const handleUpdate = async () => {
        if (selectedFolderId && folderName.trim()) {
            await onRename(selectedFolderId, folderName.trim());
            setMode('list');
        }
    };

    const startEdit = (folder: Folder) => {
        setSelectedFolderId(folder.id);
        setFolderName(folder.name);
        setMode('edit');
    };

    const handleDelete = async (id: string) => {
        await onDelete(id);
    };

    const renderContent = () => {
        if (mode === 'list') {
            return (
                <ScrollView style={{ maxHeight: 300 }}>
                    {folders.map(folder => (
                        <List.Item
                            key={folder.id}
                            title={folder.name}
                            left={props => (
                                <List.Icon {...props} icon="folder" color={folder.color} />
                            )}
                            right={props => (
                                <View style={{ flexDirection: 'row' }}>
                                    {folder.id !== DEFAULT_FOLDER.id && (
                                        <>
                                            <IconButton
                                                icon="pencil"
                                                size={20}
                                                onPress={() => startEdit(folder)}
                                            />
                                            <IconButton
                                                icon="delete"
                                                size={20}
                                                iconColor={theme.colors.error}
                                                onPress={() => handleDelete(folder.id)}
                                            />
                                        </>
                                    )}
                                </View>
                            )}
                        />
                    ))}
                    <Button
                        mode="outlined"
                        icon="plus"
                        onPress={() => {
                            setFolderName('');
                            setMode('create');
                        }}
                        style={{ marginTop: 16 }}>
                        Create New Folder
                    </Button>
                </ScrollView>
            );
        }

        return (
            <View>
                <TextInput
                    label="Folder Name"
                    value={folderName}
                    onChangeText={setFolderName}
                    mode="outlined"
                    autoFocus
                />
            </View>
        );
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>
                    {mode === 'list'
                        ? 'Manage Folders'
                        : mode === 'create'
                          ? 'New Folder'
                          : 'Edit Folder'}
                </Dialog.Title>
                <Dialog.Content>{renderContent()}</Dialog.Content>
                <Dialog.Actions>
                    {mode === 'list' ? (
                        <Button onPress={onDismiss}>Done</Button>
                    ) : (
                        <>
                            <Button onPress={() => setMode('list')}>Back</Button>
                            <Button onPress={mode === 'create' ? handleCreate : handleUpdate}>
                                {mode === 'create' ? 'Create' : 'Save'}
                            </Button>
                        </>
                    )}
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
