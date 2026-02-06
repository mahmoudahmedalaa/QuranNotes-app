import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Modal, Portal, Text, Button, useTheme, TextInput, Chip } from 'react-native-paper';
import { useRecordingStorage } from '../../hooks/useRecordingStorage';
import { useFolders } from '../../../infrastructure/notes/FolderContext';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import { WaveBackground } from '../animated/WaveBackground';
import { FolderPicker } from '../common/FolderPicker';

interface RecordingSaveModalProps {
    visible: boolean;
    onDismiss: () => void;
    recordingUri: string | null;
    duration: number;
    surahId?: number;
    verseId?: number;
    onSaveComplete: () => void;
}

export const RecordingSaveModal = ({
    visible,
    onDismiss,
    recordingUri,
    duration,
    surahId,
    verseId,
    onSaveComplete,
}: RecordingSaveModalProps) => {
    const theme = useTheme();
    const { saveRecording } = useRecordingStorage();
    const { folders } = useFolders();

    const [name, setName] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
    const [isSaving, setIsSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);

    useEffect(() => {
        if (visible) {
            const defaultName = surahId
                ? `Surah ${surahId}${verseId ? ` - Verse ${verseId}` : ''} Reflection`
                : `Recording ${new Date().toLocaleDateString()}`;
            setName(defaultName);
            setSelectedFolderId(undefined);
        }
    }, [visible, surahId, verseId]);

    const handleSave = async () => {
        if (!recordingUri) return;

        setIsSaving(true);
        try {
            await saveRecording({
                id: Date.now().toString(),
                name,
                uri: recordingUri,
                folderId: selectedFolderId,
                duration,
                createdAt: new Date(),
                surahId,
                verseId,
            });
            onSaveComplete();
        } catch (error) {
            console.error('Failed to save recording:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[
                    styles.container,
                    { backgroundColor: theme.colors.surface },
                ]}>
                <View style={styles.modalContent}>
                    <WaveBackground
                        variant="spiritual"
                        intensity="subtle"
                        style={StyleSheet.absoluteFillObject}
                    />

                    <View style={styles.header}>
                        <Text
                            variant="headlineSmall"
                            style={[styles.title, { color: theme.colors.primary }]}>
                            Preserve Reflection
                        </Text>
                        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                            Duration: {formatDuration(duration)}
                        </Text>
                    </View>

                    <TextInput
                        label="Reflection Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        style={styles.input}
                        outlineStyle={{ borderRadius: BorderRadius.lg }}
                        activeOutlineColor={theme.colors.primary}
                    />

                    {folders.length > 0 && (
                        <View style={styles.folderSection}>
                            <Text
                                variant="labelLarge"
                                style={[
                                    styles.sectionLabel,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}>
                                Assign to Folder
                            </Text>
                            <Button
                                mode="outlined"
                                onPress={() => setPickerVisible(true)}
                                icon="folder-outline"
                                style={styles.pickerButton}
                                contentStyle={styles.pickerButtonContent}
                                labelStyle={{ color: theme.colors.onSurface }}>
                                {folders.find(f => f.id === selectedFolderId)?.name || 'None'}
                            </Button>

                            <FolderPicker
                                visible={pickerVisible}
                                onDismiss={() => setPickerVisible(false)}
                                onSelect={setSelectedFolderId}
                                selectedFolderId={selectedFolderId}
                                folders={folders}
                            />
                        </View>
                    )}

                    <View style={styles.actions}>
                        <Button onPress={onDismiss} textColor={theme.colors.onSurfaceVariant}>
                            Discard
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleSave}
                            loading={isSaving}
                            style={styles.saveButton}>
                            Save
                        </Button>
                    </View>
                </View>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 20,
        borderRadius: BorderRadius.xxl,
        alignSelf: 'center',
        width: '90%',
        maxWidth: 400,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    modalContent: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        fontWeight: '800',
        marginBottom: 4,
    },
    input: {
        backgroundColor: 'transparent',
        marginBottom: Spacing.xl,
    },
    folderSection: {
        marginBottom: Spacing.xl,
    },
    sectionLabel: {
        fontWeight: '700',
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
    },
    pickerButton: {
        borderRadius: BorderRadius.lg,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    pickerButtonContent: {
        height: 48,
        justifyContent: 'flex-start',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    saveButton: {
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
    },
});
